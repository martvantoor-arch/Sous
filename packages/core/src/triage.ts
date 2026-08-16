// De triage wachtrij afhandelen.
//
// `CLAUDE.md`: het systeem maakt nooit zelf een persoon of project aan. Het doet
// een voorstel; Marten keurt het goed. Dit bestand is die goedkeuring.
//
// Twee soorten items komen hier langs:
//
// 1. **Voorstellen voor iets nieuws** — een persoon, een project, een vakterm.
//    Goedkeuren betekent aanmaken. Dit is de enige weg waarlangs die tabellen
//    groeien buiten de seed om.
// 2. **Vragen over iets bestaands** — wie is de eigenaar van deze toezegging,
//    klopt deze lezing, hoort dit bij dit project. Daar valt niets aan te
//    maken; goedkeuren betekent hier "ik heb ernaar gekeken".
//
// Elke mutatie schrijft een regel in `change_log` met de bron erbij, zodat
// achteraf te zien is waar een persoon of term vandaan komt.
import {
  changeLog,
  eq,
  getDb,
  people,
  projects,
  terms,
  triageQueue,
  type DbOrTx,
} from '@meetinghub/db';

export type TriageBesluit = 'akkoord' | 'afgewezen';

export interface TriageUitkomst {
  status: TriageBesluit;
  /** Wat er is aangemaakt, als er iets is aangemaakt. */
  aangemaakt?: { soort: 'persoon' | 'project' | 'term'; id: string; naam: string };
}

/** Leest een tekstveld uit een voorstel, ongeacht hoe het model het noemde. */
function tekst(voorstel: Record<string, unknown>, ...sleutels: string[]): string | null {
  for (const s of sleutels) {
    const v = voorstel[s];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function lijst(voorstel: Record<string, unknown>, ...sleutels: string[]): string[] {
  for (const s of sleutels) {
    const v = voorstel[s];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && !!x.trim());
  }
  return [];
}

/**
 * Handelt één triage-item af.
 *
 * Bij `afgewezen` wordt er niets aangemaakt; het item verdwijnt uit de wachtrij
 * en blijft bewaard, zodat dezelfde vraag bij een herdraai niet opnieuw komt.
 */
export async function resolveTriage(
  triageId: string,
  besluit: TriageBesluit,
  opties: { correctie?: Record<string, unknown>; db?: DbOrTx } = {},
): Promise<TriageUitkomst> {
  const db = opties.db ?? getDb();

  const [item] = await db.select().from(triageQueue).where(eq(triageQueue.id, triageId));
  if (!item) throw new Error(`triage-item ${triageId} bestaat niet`);
  if (item.status !== 'open') throw new Error(`triage-item ${triageId} is al ${item.status}`);

  const uitkomst: TriageUitkomst = { status: besluit };

  if (besluit === 'akkoord') {
    // Het voorstel van het model is een gok, geen waarheid. Een verhaspelde
    // naam corrigeer je hier, vóór hij het geheugen in gaat — daarna staat hij
    // in elke prompt en in elke koppeling.
    const voorstel = {
      ...((item.proposal ?? {}) as Record<string, unknown>),
      ...(opties.correctie ?? {}),
    };
    const gemaakt = await maakAan(db, item.kind, voorstel, item.sourceId);
    if (gemaakt) uitkomst.aangemaakt = gemaakt;
  }

  await db
    .update(triageQueue)
    .set({ status: besluit, resolvedAt: new Date() })
    .where(eq(triageQueue.id, triageId));

  return uitkomst;
}

async function maakAan(
  db: DbOrTx,
  kind: string,
  voorstel: Record<string, unknown>,
  sourceId: string | null,
): Promise<TriageUitkomst['aangemaakt']> {
  const noteer = async (soort: string, id: string, naam: string) => {
    await db.insert(changeLog).values({
      entityType: soort,
      entityId: id,
      field: 'aangemaakt',
      oldValue: null,
      newValue: naam,
      sourceId,
      origin: 'gesprek',
      quote: tekst(voorstel, 'citaat', 'context'),
    });
  };

  switch (kind) {
    case 'persoon_onbekend':
    case 'nieuwe_persoon': {
      const naam = tekst(voorstel, 'naam', 'name');
      if (!naam) throw new Error('voorstel bevat geen naam');
      const [rij] = await db
        .insert(people)
        .values({
          name: naam,
          role: tekst(voorstel, 'rol', 'role'),
          organisation: tekst(voorstel, 'organisatie', 'organisation'),
          isInternal: voorstel.is_intern !== false,
          aliases: lijst(voorstel, 'varianten', 'aliases'),
        })
        .returning({ id: people.id });
      await noteer('persoon', rij!.id, naam);
      return { soort: 'persoon', id: rij!.id, naam };
    }

    case 'project_onbekend':
    case 'project': {
      const naam = tekst(voorstel, 'naam', 'name', 'naam_raw');
      if (!naam) throw new Error('voorstel bevat geen projectnaam');
      const [rij] = await db
        .insert(projects)
        .values({
          name: naam,
          description: tekst(voorstel, 'omschrijving', 'context'),
          aliases: lijst(voorstel, 'varianten', 'aliases'),
        })
        .returning({ id: projects.id });
      await noteer('project', rij!.id, naam);
      return { soort: 'project', id: rij!.id, naam };
    }

    case 'nieuwe_term': {
      const term = tekst(voorstel, 'vermoedelijke_term', 'term');
      if (!term) throw new Error('voorstel bevat geen term');
      const [rij] = await db
        .insert(terms)
        .values({
          term,
          expansion: tekst(voorstel, 'betekenis', 'expansion'),
          variants: lijst(voorstel, 'varianten', 'variants'),
          note: tekst(voorstel, 'context', 'note'),
        })
        .returning({ id: terms.id });
      await noteer('term', rij!.id, term);
      return { soort: 'term', id: rij!.id, naam: term };
    }

    default:
      // Een vraag over iets bestaands. Er valt niets aan te maken; goedkeuren
      // betekent hier alleen dat de vraag beantwoord is.
      return undefined;
  }
}
