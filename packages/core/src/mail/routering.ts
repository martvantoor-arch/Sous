// Van het plusadres naar een project.
//
// `marten+blk@example.nl` betekent: deze mail hoort bij BLK. Dat is geen
// gevolgtrekking uit de inhoud maar een instructie die Marten zelf getypt
// heeft, en daarmee het sterkste signaal dat we over een bron hebben. Sterker
// dan wat een model uit de tekst afleidt, en dus krijgt het zekerheid 1.00.
//
// Wat het níet doet: een project aanmaken. Een onbekend label is een vraag
// voor de triage, geen aanleiding om iets te verzinnen. De mail komt gewoon
// binnen; alleen zonder koppeling.
import { getDb, projects, sql, type DbOrTx } from '@meetinghub/db';

export interface Routering {
  label: string;
  projectId: string | null;
  projectNaam: string | null;
  /** hoe het label matchte: op de projectcode of op een alias */
  via: 'code' | 'alias' | null;
}

/**
 * Zoekt het project dat bij een routeringslabel hoort.
 *
 * Eerst op `code`, want dat is de afkorting die Marten in een adres typt.
 * Daarna op de aliassen, zodat `+diepvries` ook aankomt als het project
 * "AH private label diepvries" heet. Allebei hoofdletterongevoelig: niemand
 * let daarop in een mailadres.
 */
export async function zoekProjectVoorLabel(
  label: string,
  db: DbOrTx = getDb(),
): Promise<Routering> {
  const genormaliseerd = label.trim().toLowerCase();
  if (!genormaliseerd) return { label, projectId: null, projectNaam: null, via: null };

  const [opCode] = await db
    .select({ id: projects.id, naam: projects.name })
    .from(projects)
    .where(sql`lower(${projects.code}) = ${genormaliseerd}`)
    .limit(1);

  if (opCode) {
    return { label, projectId: opCode.id, projectNaam: opCode.naam, via: 'code' };
  }

  // `aliases` is een text[]; deze vergelijking maakt er een kleine-letters
  // array van zodat `ARRAY['Diepvries'] @> ARRAY['diepvries']` ook aankomt.
  const [opAlias] = await db
    .select({ id: projects.id, naam: projects.name })
    .from(projects)
    .where(
      sql`exists (
        select 1 from unnest(${projects.aliases}) as alias
        where lower(alias) = ${genormaliseerd}
      )`,
    )
    .limit(1);

  if (opAlias) {
    return { label, projectId: opAlias.id, projectNaam: opAlias.naam, via: 'alias' };
  }

  return { label, projectId: null, projectNaam: null, via: null };
}
