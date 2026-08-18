// De envelop binnenhalen. De brief komt later.
//
// Deze stap schrijft alleen op wát er binnenkwam en van wie, en zet de rest in
// de wachtrij. Dat is met opzet: Resend levert bij een inkomende mail alleen
// metadata, en een webhook die eerst een body gaat ophalen bij een derde
// partij is een webhook die kan aflopen. Wat hier wegschrijft moet altijd
// lukken, ook als Resend er daarna even uit ligt.
import {
  changeLog,
  getDb,
  people,
  sourceMail,
  sources,
  sql,
  triageQueue,
  eq,
} from '@meetinghub/db';
import { enqueueMailBody } from '../queue.js';
import { kiesRoutering, leesAdres, leesAdressen } from './adres.js';
import { zoekProjectVoorLabel } from './routering.js';
import type { InboundMail } from './payload.js';

export interface MailOntvangst {
  sourceId: string;
  status: 'in wachtrij' | 'reeds ontvangen';
  routing: { label: string; project: string | null } | null;
}

export async function ontvangMail(payload: InboundMail): Promise<MailOntvangst> {
  const db = getDb();
  const d = payload.data;

  // Het RFC Message-ID gaat voor. Dat blijft gelijk als Resend dezelfde mail
  // twee keer aflevert én als hij ooit via een andere provider binnenkomt;
  // `email_id` is alleen van Resend.
  const externalId = d.message_id ? `mail:${d.message_id}` : `resend:${d.email_id}`;

  const afzender = leesAdres(d.from);
  const ontvangers = leesAdressen(d.received_for.length ? d.received_for : d.to);
  const routering = kiesRoutering([...ontvangers, ...leesAdressen(d.cc)]);

  const ontvangenOp = d.created_at ? new Date(d.created_at) : new Date();
  const occurredAt = Number.isNaN(ontvangenOp.getTime()) ? new Date() : ontvangenOp;

  const ingevoegd = await db
    .insert(sources)
    .values({
      type: 'mail',
      externalId,
      title: d.subject?.trim() || '(geen onderwerp)',
      occurredAt,
      // Leeg, en niet opgeruimd: de body moet nog opgehaald worden. Zodra
      // `mail.body` klaar is staat hij er, en pas dan gaat de extractie lopen.
      rawText: null,
    })
    .onConflictDoNothing({ target: sources.externalId })
    .returning({ id: sources.id });

  const nieuw = ingevoegd[0];
  if (!nieuw) {
    const [bekend] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.externalId, externalId));
    return { sourceId: bekend!.id, status: 'reeds ontvangen', routing: null };
  }

  const project = routering ? await zoekProjectVoorLabel(routering.label, db) : null;

  await db.insert(sourceMail).values({
    sourceId: nieuw.id,
    fromRaw: afzender.ruw || '(geen afzender)',
    fromPersonId: await zoekPersoon(afzender.adres),
    toRaw: leesAdressen(d.to).map((a) => a.ruw),
    ccRaw: leesAdressen(d.cc).map((a) => a.ruw),
    routingTag: routering?.label ?? null,
    messageId: d.message_id ?? null,
  });

  if (project?.projectId) {
    // Zekerheid 1.00: dit is geen gevolgtrekking maar een instructie. Marten
    // heeft het adres zelf getypt.
    await db
      .update(sources)
      .set({ projectId: project.projectId, projectConf: '1.00' })
      .where(eq(sources.id, nieuw.id));

    await db.insert(changeLog).values({
      entityType: 'source',
      entityId: nieuw.id,
      field: 'project_id',
      oldValue: null,
      newValue: project.projectId,
      sourceId: nieuw.id,
      origin: 'mail',
      quote: `geadresseerd aan +${project.label}`,
    });
  } else if (routering) {
    // Wel een label, geen project. Het systeem maakt er zelf niets van.
    await db.insert(triageQueue).values({
      sourceId: nieuw.id,
      kind: 'project_onbekend',
      proposal: { label: routering.label, adres: routering.adres.adres },
      question:
        `Deze mail kwam binnen op +${routering.label}, maar er is geen project met die code ` +
        `of alias. Hoort hij bij een bestaand project, of is dit een nieuw project?`,
      confidence: '0.50',
    });
  }

  await enqueueMailBody({ sourceId: nieuw.id, emailId: d.email_id });

  return {
    sourceId: nieuw.id,
    status: 'in wachtrij',
    routing: routering ? { label: routering.label, project: project?.projectNaam ?? null } : null,
  };
}

/**
 * Koppelt de afzender aan een bekend persoon, op adres.
 *
 * Alleen op een exacte match. Gokken op een naam die op elkaar lijkt is
 * precies het soort stille fout waar dit systeem niet op gebouwd is; een
 * onbekende afzender levert straks een triagevraag op uit de extractie.
 */
async function zoekPersoon(adres: string): Promise<string | null> {
  if (!adres) return null;

  const [gevonden] = await getDb()
    .select({ id: people.id })
    .from(people)
    .where(sql`lower(${people.email}) = ${adres.toLowerCase()}`)
    .limit(1);

  return gevonden?.id ?? null;
}
