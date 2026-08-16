// Opruimen van ruwe transcripten.
//
// Kernprincipe 1 zegt dat ruwe tekst heilig is, en dat blijft waar zolang een
// bron in het geheugen hoort. Maar `CLAUDE.md` zet daar een bewaartermijn
// naast: na achttien maanden houden we alleen de gestructureerde extracties
// over. Dit bestand is de uitvoering van die regel, plus de mogelijkheid om
// hem eerder toe te passen als daar reden voor is.
//
// Wat er verdwijnt is `raw_text` en `summary_text`. Wat er blijft is de bron
// zelf met zijn titel, datum en herkomst, en alles wat eruit geëxtraheerd is:
// besluiten, toezeggingen, open vragen, risico's, citaten. Een geleegde bron
// is dus geen gat in het geheugen; alleen het bewijsmateriaal eronder is weg.
//
// Let op wat je daarmee opgeeft. Zonder ruwe tekst kun je een extractie niet
// opnieuw draaien en kan `verify-quotes` de citaten niet meer toetsen. Doe dit
// dus niet op een bron waarvan de extractie nog niet is nagekeken.
import { sql as raw } from 'drizzle-orm';
import type { Database } from './client.js';
import { sources } from './schema.js';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';

/** Welke bronnen je wilt legen. */
export type PurgeScope =
  /** Alles wat via de evaluatieset of een testfixture binnenkwam. */
  | { kind: 'fixtures' }
  /** Bronnen ouder dan een aantal maanden. De bewaartermijn uit CLAUDE.md. */
  | { kind: 'olderThanMonths'; months: number }
  /** Specifieke bronnen, op id. */
  | { kind: 'ids'; ids: string[] }
  /** Alles. Alleen met opzet. */
  | { kind: 'all' };

export interface PurgeResult {
  /** Bronnen die binnen de selectie vallen en nog ruwe tekst hebben. */
  gevonden: { id: string; titel: string | null; externalId: string | null; tekens: number }[];
  /** Aantal bronnen dat daadwerkelijk geleegd is. Nul bij een proefrun. */
  geleegd: number;
  /** Totaal aantal tekens ruwe tekst dat verdwenen is. */
  tekensVerwijderd: number;
}

function selectie(scope: PurgeScope) {
  switch (scope.kind) {
    case 'fixtures':
      // Fixtures komen binnen als `fixture:<naam>`; evaluatieruns die via de
      // webhook binnenkwamen als `pocket:run<nummer>-m<nummer>`.
      return raw`(${sources.externalId} like 'fixture:%' or ${sources.externalId} ~ '^pocket:run[0-9]+-m[0-9]+$')`;
    case 'olderThanMonths':
      return raw`${sources.occurredAt} < now() - ${`${scope.months} months`}::interval`;
    case 'ids':
      return scope.ids.length ? inArray(sources.id, scope.ids) : raw`false`;
    case 'all':
      return raw`true`;
  }
}

/**
 * Leegt de ruwe tekst van de geselecteerde bronnen.
 *
 * Draait standaard als **proefrun**: hij vertelt wat hij zou doen en verandert
 * niets. Pas met `apply: true` wordt er geschreven. Dat is expres omslachtig;
 * dit is de enige plek in het systeem die informatie weggooit.
 */
export async function purgeTranscripts(
  db: Database,
  scope: PurgeScope,
  options: { apply?: boolean } = {},
): Promise<PurgeResult> {
  const waar = and(selectie(scope), raw`${sources.rawText} is not null`);

  const gevonden = await db
    .select({
      id: sources.id,
      titel: sources.title,
      externalId: sources.externalId,
      tekens: sql<number>`coalesce(length(${sources.rawText}), 0) + coalesce(length(${sources.summaryText}), 0)`,
    })
    .from(sources)
    .where(waar);

  const tekens = gevonden.reduce((som, r) => som + Number(r.tekens), 0);

  if (!options.apply || gevonden.length === 0) {
    return { gevonden, geleegd: 0, tekensVerwijderd: 0 };
  }

  await db
    .update(sources)
    .set({
      rawText: null,
      summaryText: null,
      // Zonder deze markering is later niet te zien of een bron nooit tekst had
      // of dat hij is opgeruimd. Dat verschil telt bij het beoordelen van een
      // oude extractie.
      rawPurgedAt: new Date(),
    })
    .where(inArray(sources.id, gevonden.map((r) => r.id)));

  return { gevonden, geleegd: gevonden.length, tekensVerwijderd: tekens };
}

/** Bronnen die geleegd zijn, voor de weergave op de brondetailpagina. */
export async function isPurged(db: Database, sourceId: string): Promise<boolean> {
  const [row] = await db
    .select({ purged: sources.rawPurgedAt })
    .from(sources)
    .where(and(eq(sources.id, sourceId), isNull(sources.rawText)));
  return Boolean(row?.purged);
}
