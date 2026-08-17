// Van extractie naar geheugen.
//
// Tot nu toe bleef een extractie als JSON in `extractions` staan. Bruikbaar om
// een run te beoordelen, maar het is geen geheugen: je kunt er niet in zoeken,
// niets aan opvolgen, en dezelfde toezegging uit drie meetings staat er drie
// keer in zonder dat iemand dat ziet.
//
// Deze stap zet de extractie om in rijen, en doet dat voor toezeggingen met een
// tussenstap: eerst vragen we het model of een nieuwe toezegging over een
// bestaande gaat. Dat is de reconciliatie.
//
// Besluiten, open vragen, risico's en cijfers gaan zonder reconciliatie naar
// binnen. Die zijn gebonden aan de bron waarin ze vielen — een besluit uit
// augustus blijft een besluit uit augustus. Alleen toezeggingen leven door de
// tijd heen, en alleen daar heeft matchen zin.
import {
  changeLog,
  commitments,
  decisions,
  eq,
  getDb,
  inArray,
  metrics,
  openQuestions,
  risks,
  sources,
  triageQueue,
  and,
  isNull,
  sql,
  type DbOrTx,
} from '@meetinghub/db';
import { callClaude } from '../anthropic.js';
import { EXTRACTION_EFFORT, EXTRACTION_MAX_TOKENS, EXTRACTION_MODEL } from '../config.js';
import { loadPrompt } from '../prompts.js';
import type { Extraction } from '../extract/schema.js';
import { parseReconciliatie, type Koppeling } from './schema.js';

const RECONCILE_PROMPT = 'reconcile-v1';

export interface ReconciliatieResultaat {
  nieuweToezeggingen: number;
  bijgewerkt: number;
  afgerond: number;
  vervallen: number;
  opnieuwGenoemd: number;
  besluiten: number;
  openVragen: number;
  risicos: number;
  cijfers: number;
}

/**
 * Schrijft een extractie weg als geheugen.
 *
 * Draait in één transactie: half gematerialiseerd is erger dan niet, want dan
 * lijkt een toezegging nieuw terwijl hij dat niet is.
 */
export async function materialiseer(
  sourceId: string,
  result: Extraction,
): Promise<ReconciliatieResultaat> {
  const db = getDb();
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!source) throw new Error(`bron ${sourceId} bestaat niet`);

  // De reconciliatie roept Claude aan en hoort dus buiten de transactie: een
  // openstaande transactie tijdens een call van vijf minuten houdt een
  // verbinding bezet en blokkeert de rest.
  const openstaand = await openstaandeToezeggingen(db);
  const koppelingen = await reconcilieer(sourceId, openstaand, result);

  return db.transaction(async (tx) => {
    // Een herdraai van dezelfde bron mag niet alles verdubbelen. Wat uit déze
    // bron kwam gaat eruit; wat er in andere bronnen mee gebeurd is blijft.
    await tx.delete(decisions).where(eq(decisions.sourceId, sourceId));
    await tx.delete(openQuestions).where(eq(openQuestions.sourceId, sourceId));
    await tx.delete(risks).where(eq(risks.sourceId, sourceId));
    await tx.delete(metrics).where(eq(metrics.sourceId, sourceId));

    const telling: ReconciliatieResultaat = {
      nieuweToezeggingen: 0,
      bijgewerkt: 0,
      afgerond: 0,
      vervallen: 0,
      opnieuwGenoemd: 0,
      besluiten: result.besluiten.length,
      openVragen: result.open_vragen.length,
      risicos: result.risicos.length,
      cijfers: result.cijfers.length,
    };

    for (const b of result.besluiten) {
      await tx.insert(decisions).values({
        projectId: b.project,
        sourceId,
        what: b.wat,
        decidedBy: b.wie ?? null,
        decidedOn: b.wanneer ?? null,
        context: b.context ?? null,
        quote: b.citaat ?? null,
        confidence: b.confidence.toFixed(2),
      });
    }

    for (const v of result.open_vragen) {
      await tx.insert(openQuestions).values({
        projectId: v.project,
        sourceId,
        question: v.vraag,
        ownerId: v.owner ?? null,
      });
    }

    for (const r of result.risicos) {
      await tx.insert(risks).values({
        projectId: r.project,
        sourceId,
        description: r.omschrijving,
        severity: r.ernst ?? null,
      });
    }

    for (const c of result.cijfers) {
      await tx.insert(metrics).values({
        projectId: c.project,
        sourceId,
        name: c.naam,
        value: c.waarde != null ? String(c.waarde) : null,
        unit: c.eenheid ?? null,
        asOf: c.datum ?? null,
        quote: c.citaat ?? null,
      });
    }

    for (const [index, t] of result.toezeggingen.entries()) {
      const koppeling = koppelingen.get(index);
      await verwerkToezegging(tx, sourceId, t, koppeling, telling);
    }

    return telling;
  });
}

type ToezeggingUitExtractie = Extraction['toezeggingen'][number];
type OpenToezegging = { id: string; what: string; ownerRaw: string | null; deadline: string | null };

async function openstaandeToezeggingen(db: DbOrTx): Promise<OpenToezegging[]> {
  return db
    .select({
      id: commitments.id,
      what: commitments.what,
      ownerRaw: commitments.ownerRaw,
      deadline: commitments.deadline,
    })
    .from(commitments)
    .where(inArray(commitments.status, ['open', 'bijgewerkt', 'stil']));
}

/**
 * Vraagt het model welke nieuwe toezeggingen over bestaande gaan.
 *
 * Slaat de call over als er nog niets in het geheugen staat of als de bron geen
 * toezeggingen opleverde — dan valt er niets te matchen en is alles nieuw.
 * Faalt de call, dan is alles nieuw: een dubbele toezegging is te herstellen,
 * een verdwenen niet.
 */
async function reconcilieer(
  sourceId: string,
  openstaand: OpenToezegging[],
  result: Extraction,
): Promise<Map<number, Koppeling>> {
  const leeg = new Map<number, Koppeling>();
  if (openstaand.length === 0 || result.toezeggingen.length === 0) return leeg;

  const prompt = await loadPrompt(RECONCILE_PROMPT);

  const invoer = [
    '# AL IN HET GEHEUGEN',
    JSON.stringify(
      openstaand.map((t) => ({
        id: t.id,
        wat: t.what,
        owner_raw: t.ownerRaw,
        deadline: t.deadline,
      })),
      null,
      2,
    ),
    '',
    '# NIEUW UIT DEZE BRON',
    JSON.stringify(
      result.toezeggingen.map((t, i) => ({
        index: i,
        wat: t.wat,
        owner_raw: t.owner_raw,
        deadline_raw: t.deadline_raw,
        citaat: t.citaat,
      })),
      null,
      2,
    ),
  ].join('\n');

  try {
    const { text } = await callClaude({
      model: EXTRACTION_MODEL,
      maxTokens: EXTRACTION_MAX_TOKENS,
      effort: EXTRACTION_EFFORT,
      systemBlocks: [prompt.system],
      userText: invoer,
      kind: 'reconciliatie',
      promptVersion: prompt.version,
      promptFingerprint: prompt.fingerprint,
      sourceId,
    });

    const gelezen = parseReconciliatie(text);
    return new Map(gelezen.koppelingen.map((k) => [k.nieuw_index, k]));
  } catch (err) {
    console.error(
      '[reconciliatie] mislukt, alle toezeggingen als nieuw opgenomen:',
      err instanceof Error ? err.message : err,
    );
    return leeg;
  }
}

async function verwerkToezegging(
  tx: DbOrTx,
  sourceId: string,
  toezegging: ToezeggingUitExtractie,
  koppeling: Koppeling | undefined,
  telling: ReconciliatieResultaat,
): Promise<void> {
  const nu = new Date();
  const uitkomst = koppeling?.uitkomst ?? 'nieuw';

  if (uitkomst === 'nieuw' || !koppeling?.bestaand_id) {
    const [rij] = await tx
      .insert(commitments)
      .values({
        projectId: toezegging.project,
        what: toezegging.wat,
        ownerId: toezegging.owner ?? null,
        ownerRaw: toezegging.owner_raw ?? null,
        promisedToId: toezegging.aan_wie ?? null,
        deadline: toezegging.deadline ?? null,
        deadlineRaw: toezegging.deadline_raw ?? null,
        status: 'open',
        statusSource: 'meeting',
        statusConf: toezegging.confidence.toFixed(2),
        firstSeenSource: sourceId,
        lastSeenSource: sourceId,
        lastSeenAt: nu,
      })
      .returning({ id: commitments.id });

    telling.nieuweToezeggingen += 1;
    await noteer(tx, rij!.id, 'aangemaakt', null, toezegging.wat, sourceId, toezegging.citaat);
    await eventueelTriage(tx, sourceId, koppeling, toezegging.wat);
    return;
  }

  const bestaandId = koppeling.bestaand_id;
  const [voor] = await tx.select().from(commitments).where(eq(commitments.id, bestaandId));
  if (!voor) {
    // De toezegging is tussendoor verdwenen. Niet stilzwijgend laten vallen.
    telling.nieuweToezeggingen += 1;
    await tx.insert(commitments).values({
      projectId: toezegging.project,
      what: toezegging.wat,
      ownerRaw: toezegging.owner_raw ?? null,
      status: 'open',
      statusSource: 'meeting',
      firstSeenSource: sourceId,
      lastSeenSource: sourceId,
      lastSeenAt: nu,
    });
    return;
  }

  const gemeenschappelijk = {
    lastSeenSource: sourceId,
    lastSeenAt: nu,
    statusSource: 'meeting' as const,
    statusConf: koppeling.confidence.toFixed(2),
  };

  if (uitkomst === 'afgerond' || uitkomst === 'vervallen') {
    await tx
      .update(commitments)
      .set({
        ...gemeenschappelijk,
        status: uitkomst,
        closedAt: nu,
        closedQuote: koppeling.citaat,
      })
      .where(eq(commitments.id, bestaandId));

    telling[uitkomst === 'afgerond' ? 'afgerond' : 'vervallen'] += 1;
    await noteer(tx, bestaandId, 'status', voor.status, uitkomst, sourceId, koppeling.citaat);
  } else if (uitkomst === 'bijgewerkt') {
    await tx
      .update(commitments)
      .set({
        ...gemeenschappelijk,
        status: 'bijgewerkt',
        // Alleen overschrijven wat de nieuwe bron werkelijk noemt.
        deadline: toezegging.deadline ?? voor.deadline,
        deadlineRaw: toezegging.deadline_raw || voor.deadlineRaw,
        ownerId: toezegging.owner ?? voor.ownerId,
        ownerRaw: toezegging.owner_raw || voor.ownerRaw,
      })
      .where(eq(commitments.id, bestaandId));

    telling.bijgewerkt += 1;
    await noteer(
      tx,
      bestaandId,
      'bijgewerkt',
      voor.what,
      koppeling.wijziging ?? toezegging.wat,
      sourceId,
      koppeling.citaat,
    );
  } else {
    // `zelfde`: alleen opnieuw genoemd. Dat is geen wijziging maar wel een
    // levensteken — en precies dat houdt hem uit de stiltedetectie.
    await tx
      .update(commitments)
      .set({
        ...gemeenschappelijk,
        // Was hij stil geworden, dan leeft hij weer.
        status: voor.status === 'stil' ? 'open' : voor.status,
      })
      .where(eq(commitments.id, bestaandId));

    telling.opnieuwGenoemd += 1;
    if (voor.status === 'stil') {
      await noteer(tx, bestaandId, 'status', 'stil', 'open', sourceId, koppeling.citaat);
    }
  }

  await eventueelTriage(tx, sourceId, koppeling, voor.what);
}

async function noteer(
  tx: DbOrTx,
  id: string,
  veld: string,
  oud: string | null,
  nieuw: string | null,
  sourceId: string,
  citaat: string | null | undefined,
): Promise<void> {
  await tx.insert(changeLog).values({
    entityType: 'toezegging',
    entityId: id,
    field: veld,
    oldValue: oud,
    newValue: nieuw,
    sourceId,
    origin: 'reconciliatie',
    quote: citaat ?? null,
  });
}

/** Twijfel van het model hoort in de wachtrij, niet in een logregel. */
async function eventueelTriage(
  tx: DbOrTx,
  sourceId: string,
  koppeling: Koppeling | undefined,
  wat: string,
): Promise<void> {
  if (!koppeling?.vraag) return;

  await tx.insert(triageQueue).values({
    sourceId,
    kind: 'toezegging',
    proposal: { wat, uitkomst: koppeling.uitkomst, bestaand_id: koppeling.bestaand_id },
    question: koppeling.vraag,
    confidence: koppeling.confidence.toFixed(2),
  });
}

/**
 * De stilteregel.
 *
 * Kernprincipe 4: een toezegging die niet meer genoemd wordt is niet afgerond,
 * die is stil. Stilte is een signaal, geen status — dus geen enkele toezegging
 * wordt hierdoor afgesloten. Hij wordt alleen zichtbaar gemaakt.
 *
 * Dit is een regel, geen model. Of iets al een tijd niet meer langskwam is een
 * feit uit de database, en daar hoeft niemand een oordeel over te vellen.
 */
export async function markeerStilteNa(dagen = 21, db: DbOrTx = getDb()): Promise<number> {
  const stil = await db
    .update(commitments)
    .set({ status: 'stil', statusSource: 'regel', statusConf: null })
    .where(
      and(
        inArray(commitments.status, ['open', 'bijgewerkt']),
        isNull(commitments.closedAt),
        // `coalesce` vangt de toezegging die nooit een levensteken kreeg: dan
        // telt zijn aanmaakmoment. Zonder dat zou juist zo'n toezegging — die
        // in geen enkele meeting terugkwam — nooit als stil opvallen.
        sql`coalesce(${commitments.lastSeenAt}, ${commitments.createdAt}) < now() - ${`${dagen} days`}::interval`,
      ),
    )
    .returning({ id: commitments.id, what: commitments.what });

  for (const rij of stil) {
    await db.insert(changeLog).values({
      entityType: 'toezegging',
      entityId: rij.id,
      field: 'status',
      oldValue: 'open',
      newValue: 'stil',
      sourceId: null,
      origin: 'regel',
      quote: null,
    });
  }

  return stil.length;
}
