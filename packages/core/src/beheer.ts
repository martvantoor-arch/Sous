// Handmatig beheer van personen, projecten en vaktermen.
//
// Dit is de tegenhanger van de extractie: wat het model voorstelt komt via de
// triage wachtrij binnen, maar Marten moet ook zonder meeting iemand kunnen
// toevoegen, een naam kunnen corrigeren of iemand kunnen laten vertrekken.
//
// Twee regels gelden overal in dit bestand:
//
// 1. **Elke mutatie schrijft in `change_log`**, met herkomst `gesprek` — dit is
//    Marten die het zelf doet, niet een extractie. Zonder die regel is later
//    niet te zien waarom een alias veranderde of wie iemand op inactief zette.
// 2. **Verwijderen kan niet als er nog iets aan hangt.** Een persoon zit aan
//    toezeggingen, besluiten en deelnemerslijsten vast. Die wegpoetsen zou het
//    geheugen stukmaken; daarom is er `deactiveer` voor wie vertrekt, en is
//    echt verwijderen alleen mogelijk zolang niemand naar hem verwijst.
import {
  changeLog,
  commitments,
  decisions,
  eq,
  getDb,
  openQuestions,
  people,
  projects,
  sourceParticipants,
  sql,
  terms,
  type DbOrTx,
} from '@meetinghub/db';


export interface PersoonInvoer {
  naam: string;
  rol?: string | null;
  organisatie?: string | null;
  isIntern: boolean;
  aliassen: string[];
  /** Mailadres, waarmee een inkomende mail aan deze persoon te hangen is. */
  email?: string | null;
  /** Aan wie deze persoon rapporteert; null is bovenaan de boom. */
  managerId?: string | null;
}

export interface TermInvoer {
  term: string;
  betekenis?: string | null;
  domein?: string | null;
  varianten: string[];
  notitie?: string | null;
}

/**
 * Mailadressen altijd in kleine letters en zonder spaties opslaan.
 *
 * De kolom is uniek, en `Bibi@AH.nl` naast `bibi@ah.nl` zou daar zonder deze
 * stap doorheen glippen. Dan staat dezelfde persoon twee keer in de lijst en
 * verdwijnt de helft van zijn toezeggingen bij de andere helft.
 */
function normaliseerEmail(waarde: string | null | undefined): string | null {
  const schoon = waarde?.trim().toLowerCase();
  return schoon || null;
}

/** Splitst een invoerveld met komma's in een schone lijst zonder duplicaten. */
export function splitsLijst(waarde: string | null | undefined): string[] {
  if (!waarde) return [];
  const gezien = new Set<string>();
  for (const deel of waarde.split(',')) {
    const schoon = deel.trim();
    if (schoon) gezien.add(schoon);
  }
  return [...gezien];
}

async function noteer(
  db: DbOrTx,
  entiteit: string,
  id: string,
  veld: string,
  oud: string | null,
  nieuw: string | null,
): Promise<void> {
  await db.insert(changeLog).values({
    entityType: entiteit,
    entityId: id,
    field: veld,
    oldValue: oud,
    newValue: nieuw,
    sourceId: null,
    origin: 'gesprek',
  });
}

/** Schrijft één regel per veld dat werkelijk veranderd is. */
async function noteerVerschillen(
  db: DbOrTx,
  entiteit: string,
  id: string,
  voor: Record<string, unknown>,
  na: Record<string, unknown>,
): Promise<void> {
  for (const veld of Object.keys(na)) {
    const oud = voor[veld];
    const nieuw = na[veld];
    const oudTekst = Array.isArray(oud) ? oud.join(', ') : (oud as string | null);
    const nieuwTekst = Array.isArray(nieuw) ? nieuw.join(', ') : (nieuw as string | null);
    if ((oudTekst ?? '') !== (nieuwTekst ?? '')) {
      await noteer(db, entiteit, id, veld, oudTekst ?? null, nieuwTekst ?? null);
    }
  }
}

// --- personen ---------------------------------------------------------------

export async function maakPersoon(invoer: PersoonInvoer, db: DbOrTx = getDb()): Promise<string> {
  const naam = invoer.naam.trim();
  if (!naam) throw new Error('een persoon heeft een naam nodig');

  const [rij] = await db
    .insert(people)
    .values({
      name: naam,
      role: invoer.rol?.trim() || null,
      organisation: invoer.organisatie?.trim() || null,
      isInternal: invoer.isIntern,
      aliases: invoer.aliassen,
      email: normaliseerEmail(invoer.email),
      managerId: invoer.managerId || null,
    })
    .returning({ id: people.id });

  await noteer(db, 'persoon', rij!.id, 'aangemaakt', null, naam);
  return rij!.id;
}

export async function wijzigPersoon(
  id: string,
  invoer: PersoonInvoer,
  db: DbOrTx = getDb(),
): Promise<void> {
  const naam = invoer.naam.trim();
  if (!naam) throw new Error('een persoon heeft een naam nodig');

  const [voor] = await db.select().from(people).where(eq(people.id, id));
  if (!voor) throw new Error(`persoon ${id} bestaat niet`);

  // Een cyclus zou het organogram laten vastlopen bij het uitklappen.
  const managerId = invoer.managerId || null;
  if (managerId === id) throw new Error('iemand kan niet aan zichzelf rapporteren');
  if (managerId && (await isNazaat(db, managerId, id))) {
    throw new Error('die manager rapporteert zelf al aan deze persoon');
  }

  const na = {
    naam,
    rol: invoer.rol?.trim() || null,
    organisatie: invoer.organisatie?.trim() || null,
    aliassen: invoer.aliassen,
    email: normaliseerEmail(invoer.email),
    manager: managerId,
  };

  await db
    .update(people)
    .set({
      name: na.naam,
      role: na.rol,
      organisation: na.organisatie,
      isInternal: invoer.isIntern,
      aliases: na.aliassen,
      email: na.email,
      managerId,
    })
    .where(eq(people.id, id));

  await noteerVerschillen(
    db,
    'persoon',
    id,
    {
      naam: voor.name,
      rol: voor.role,
      organisatie: voor.organisation,
      aliassen: voor.aliases,
      email: voor.email,
      manager: voor.managerId,
    },
    na,
  );
}

/** Loopt de keten omhoog vanaf `startId` en kijkt of `zoek` erin voorkomt. */
async function isNazaat(db: DbOrTx, startId: string, zoek: string): Promise<boolean> {
  let huidige: string | null = startId;
  const gezien = new Set<string>();
  while (huidige && !gezien.has(huidige)) {
    if (huidige === zoek) return true;
    gezien.add(huidige);
    const [rij]: { managerId: string | null }[] = await db
      .select({ managerId: people.managerId })
      .from(people)
      .where(eq(people.id, huidige));
    huidige = rij?.managerId ?? null;
  }
  return false;
}

/** Zet iemand op inactief. De geschiedenis blijft, de naam blijft koppelbaar. */
export async function zetPersoonActief(
  id: string,
  actief: boolean,
  db: DbOrTx = getDb(),
): Promise<void> {
  const [voor] = await db.select({ actief: people.active }).from(people).where(eq(people.id, id));
  if (!voor) throw new Error(`persoon ${id} bestaat niet`);
  if (voor.actief === actief) return;

  await db.update(people).set({ active: actief }).where(eq(people.id, id));
  await noteer(db, 'persoon', id, 'actief', String(voor.actief), String(actief));
}

/** Hoeveel punten er aan een persoon hangen. Nul betekent: veilig te verwijderen. */
export async function tellVerwijzingenNaarPersoon(
  id: string,
  db: DbOrTx = getDb(),
): Promise<number> {
  // Eén query in plaats van zes losse tellingen, en meteen leesbaar welke
  // tabellen een persoon vasthouden.
  const [rij] = await db.execute<{ n: number }>(sql`
    select
      (select count(*) from ${commitments} where ${commitments.ownerId} = ${id})
    + (select count(*) from ${commitments} where ${commitments.promisedToId} = ${id})
    + (select count(*) from ${decisions} where ${decisions.decidedBy} = ${id})
    + (select count(*) from ${openQuestions} where ${openQuestions.ownerId} = ${id})
    + (select count(*) from ${projects} where ${projects.ownerId} = ${id})
    + (select count(*) from ${sourceParticipants} where ${sourceParticipants.personId} = ${id})
      as n
  `);

  return Number(rij?.n ?? 0);
}

/**
 * Verwijdert een persoon definitief. Weigert zodra er nog iets aan hangt —
 * gebruik dan `zetPersoonActief(id, false)`.
 */
export async function verwijderPersoon(id: string, db: DbOrTx = getDb()): Promise<void> {
  const [rij] = await db.select({ naam: people.name }).from(people).where(eq(people.id, id));
  if (!rij) throw new Error(`persoon ${id} bestaat niet`);

  const verwijzingen = await tellVerwijzingenNaarPersoon(id, db);
  if (verwijzingen > 0) {
    throw new Error(
      `${rij.naam} hangt nog aan ${verwijzingen} ${verwijzingen === 1 ? 'punt' : 'punten'}. ` +
        'Zet hem op inactief in plaats van verwijderen; dan blijft de geschiedenis kloppen.',
    );
  }

  await noteer(db, 'persoon', id, 'verwijderd', rij.naam, null);
  await db.delete(people).where(eq(people.id, id));
}

// --- vaktermen --------------------------------------------------------------

export async function maakTerm(invoer: TermInvoer, db: DbOrTx = getDb()): Promise<string> {
  const term = invoer.term.trim();
  if (!term) throw new Error('een term heeft een schrijfwijze nodig');

  const [rij] = await db
    .insert(terms)
    .values({
      term,
      expansion: invoer.betekenis?.trim() || null,
      domain: invoer.domein?.trim() || null,
      variants: invoer.varianten,
      note: invoer.notitie?.trim() || null,
    })
    .returning({ id: terms.id });

  await noteer(db, 'term', rij!.id, 'aangemaakt', null, term);
  return rij!.id;
}

export async function wijzigTerm(
  id: string,
  invoer: TermInvoer,
  db: DbOrTx = getDb(),
): Promise<void> {
  const term = invoer.term.trim();
  if (!term) throw new Error('een term heeft een schrijfwijze nodig');

  const [voor] = await db.select().from(terms).where(eq(terms.id, id));
  if (!voor) throw new Error(`term ${id} bestaat niet`);

  const na = {
    term,
    betekenis: invoer.betekenis?.trim() || null,
    domein: invoer.domein?.trim() || null,
    varianten: invoer.varianten,
    notitie: invoer.notitie?.trim() || null,
  };

  await db
    .update(terms)
    .set({
      term: na.term,
      expansion: na.betekenis,
      domain: na.domein,
      variants: na.varianten,
      note: na.notitie,
    })
    .where(eq(terms.id, id));

  await noteerVerschillen(
    db,
    'term',
    id,
    {
      term: voor.term,
      betekenis: voor.expansion,
      domein: voor.domain,
      varianten: voor.variants,
      notitie: voor.note,
    },
    na,
  );
}

/** Een term hangt nergens aan vast, dus die mag echt weg. */
export async function verwijderTerm(id: string, db: DbOrTx = getDb()): Promise<void> {
  const [rij] = await db.select({ term: terms.term }).from(terms).where(eq(terms.id, id));
  if (!rij) throw new Error(`term ${id} bestaat niet`);

  await noteer(db, 'term', id, 'verwijderd', rij.term, null);
  await db.delete(terms).where(eq(terms.id, id));
}
