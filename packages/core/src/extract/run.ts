import {
  getDb,
  sources,
  projects,
  extractions,
  sourceProjects,
  triageQueue,
  changeLog,
  eq,
  and,
  inArray,
  type DbOrTx,
} from '@meetinghub/db';
import { callClaude } from '../anthropic.js';
import {
  EXTRACTION_EFFORT,
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_MODEL,
  EXTRACTION_PROMPT,
} from '../config.js';
import { loadPrompt } from '../prompts.js';
import { buildContext } from './context.js';
import { parseExtraction, type Extraction } from './schema.js';

/** Onder deze zekerheid koppelen we een bron niet aan een project. */
const PROJECT_LINK_THRESHOLD = 0.75;

export interface ExtractionRun {
  sourceId: string;
  extractionId: string;
  result: Extraction;
}

/**
 * Verwerkt één bron: prompt + woordenboek erin, gestructureerde extractie eruit.
 * De ruwe JSON wordt onaangetast bewaard met promptversie en model erbij, zodat
 * je hem opnieuw kunt draaien zodra de prompt beter is.
 */
export async function extractSource(
  sourceId: string,
  options: { force?: boolean } = {},
): Promise<ExtractionRun | null> {
  const db = getDb();

  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!source) throw new Error(`bron ${sourceId} bestaat niet`);
  if (source.processedAt && !options.force) return null;

  // Een opgeruimde bron opnieuw extraheren levert een lege extractie op die de
  // bestaande overschrijft. Dat is erger dan niets doen, dus weiger het.
  if (source.rawPurgedAt) {
    throw new Error(
      `bron ${sourceId} is opgeruimd op ${source.rawPurgedAt.toISOString().slice(0, 10)}; ` +
        'de ruwe tekst is weg en een nieuwe extractie zou de bestaande vervangen door niets',
    );
  }

  const [prompt, context] = await Promise.all([loadPrompt(EXTRACTION_PROMPT), buildContext()]);

  const { text } = await callClaude({
    model: EXTRACTION_MODEL,
    maxTokens: EXTRACTION_MAX_TOKENS,
    effort: EXTRACTION_EFFORT,
    systemBlocks: [prompt.system, context.text],
    userText: renderSource(source),
    kind: 'extractie',
    promptVersion: prompt.version,
    promptFingerprint: prompt.fingerprint,
    sourceId: source.id,
  });

  const result = parseExtraction(text);

  return persistExtraction(source.id, result, {
    promptVersion: prompt.version,
    model: EXTRACTION_MODEL,
  });
}

/**
 * Schrijft een extractie weg en markeert de bron als verwerkt. Los van
 * extractSource, zodat een extractie die buiten de pijplijn is gedraaid — een
 * herdraai van een oudere bron, een evaluatierun — via dezelfde weg landt.
 */
export async function persistExtraction(
  sourceId: string,
  result: Extraction,
  meta: { promptVersion: string; model: string },
): Promise<ExtractionRun> {
  const db = getDb();
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!source) throw new Error(`bron ${sourceId} bestaat niet`);

  // In een transactie: een opgeslagen extractie met een bron die op onverwerkt
  // blijft staan is een halve staat waar niemand meer uit komt.
  const extractionId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(extractions)
      .values({
        sourceId: source.id,
        promptVersion: meta.promptVersion,
        model: meta.model,
        result,
      })
      .returning({ id: extractions.id });

    await markProcessed(tx, source, result, meta);
    await linkProjects(tx, source, result);
    await queueProposals(tx, source, result);
    return row!.id;
  });

  return { sourceId: source.id, extractionId, result };
}

type SourceRow = typeof sources.$inferSelect;

/**
 * De samenvatting leidt, het transcript bewijst. De actiepunten gaan mee als
 * signaal, expliciet gelabeld zodat het model ze niet als waarheid leest.
 */
function renderSource(source: SourceRow): string {
  const parts = [
    `# BRON`,
    `type: ${source.type}`,
    `titel: ${source.title ?? '(geen titel)'}`,
    `datum: ${source.occurredAt.toISOString().slice(0, 10)}`,
  ];
  if (source.durationSec) parts.push(`duur: ${Math.round(source.durationSec / 60)} minuten`);

  parts.push(
    '',
    '# SAMENVATTING',
    source.summaryText?.trim() || '(geen samenvatting geleverd)',
    '',
    '# TRANSCRIPT',
    source.rawText ?? '(geen transcript)',
  );

  if (source.providerActions) {
    parts.push(
      '',
      '# ACTIEPUNTEN VAN DE LEVERANCIER',
      'Signaal, geen waarheid. Stelselmatig fout op eigenaarschap.',
      JSON.stringify(source.providerActions, null, 2),
    );
  }

  return parts.join('\n');
}

/**
 * Houdt alleen projecten over die echt bestaan. Een verzonnen of verouderde
 * uuid mag de hele bron niet laten omvallen op een foreign key; liever geen
 * koppeling dan een verkeerde. De ruwe extractie blijft staan om te herdraaien.
 */
async function existingProjects(
  db: DbOrTx,
  refs: Extraction['projecten'],
  sourceId: string,
): Promise<Extraction['projecten']> {
  const ids = refs.map((p) => p.id).filter((id): id is string => id !== null);
  if (ids.length === 0) return [];

  const known = new Set(
    (await db.select({ id: projects.id }).from(projects).where(inArray(projects.id, ids))).map(
      (r) => r.id,
    ),
  );

  return refs.filter((ref) => {
    if (ref.id === null) return false;
    if (known.has(ref.id)) return true;
    console.warn(
      `bron ${sourceId}: project ${ref.id} bestaat niet, niet gekoppeld ` +
        `(genoemd als "${ref.naam_raw}")`,
    );
    return false;
  });
}

async function markProcessed(
  db: DbOrTx,
  source: SourceRow,
  result: Extraction,
  meta: { promptVersion: string; model: string },
): Promise<void> {
  const sensitive = result.gevoelig.length > 0;

  // Het eerste project is het hoofdproject; de rest hangt in source_projects.
  const usable = await existingProjects(db, result.projecten, source.id);
  const primary = usable.find((p) => p.confidence >= PROJECT_LINK_THRESHOLD) ?? null;

  await db
    .update(sources)
    .set({
      processedAt: new Date(),
      promptVersion: meta.promptVersion,
      model: meta.model,
      // De ruwe bron blijft staan, met een marker en de reden erbij.
      sensitive: sensitive || source.sensitive,
      sensitiveReason: sensitive
        ? result.gevoelig.map((g) => `${g.onderwerp}: ${g.reden}`).join(' | ')
        : source.sensitiveReason,
      ...(primary
        ? { projectId: primary.id, projectConf: primary.confidence.toFixed(2) }
        : {}),
    })
    .where(eq(sources.id, source.id));

  if (primary && primary.id !== source.projectId) {
    await db.insert(changeLog).values({
      entityType: 'source',
      entityId: source.id,
      field: 'project_id',
      oldValue: source.projectId,
      newValue: primary.id,
      sourceId: source.id,
      origin: 'extractie',
      quote: primary.naam_raw || null,
    });
  }
}

/**
 * Elk project dat deze bron raakt, hoofdproject incluis. Een meeting gaat vaak
 * over meer dan een project; die punten horen elk bij hun eigen project.
 */
async function linkProjects(
  db: DbOrTx,
  source: SourceRow,
  result: Extraction,
): Promise<void> {
  const usable = await existingProjects(db, result.projecten, source.id);
  if (usable.length === 0) return;

  const primaryId = usable.find((p) => p.confidence >= PROJECT_LINK_THRESHOLD)?.id ?? null;

  // Bij een herdraai kan de vorige koppeling verouderd zijn.
  await db.delete(sourceProjects).where(eq(sourceProjects.sourceId, source.id));
  await db.insert(sourceProjects).values(
    usable.map((p) => ({
      sourceId: source.id,
      projectId: p.id!,
      confidence: p.confidence.toFixed(2),
      isPrimary: p.id === primaryId,
    })),
  );
}

/**
 * Voorstellen voor nieuwe personen gaan naar de triage wachtrij, niet naar de
 * personentabel. Marten keurt ze goed; het systeem maakt niemand zelf aan.
 * Datzelfde geldt voor de triagepunten die het model zelf aandraagt.
 */
async function queueProposals(
  db: DbOrTx,
  source: SourceRow,
  result: Extraction,
): Promise<void> {
  // Bij een herdraai zouden dezelfde vragen anders dubbel in de wachtrij komen.
  // Alleen de openstaande: wat Marten al beantwoord heeft blijft staan.
  await db
    .delete(triageQueue)
    .where(and(eq(triageQueue.sourceId, source.id), eq(triageQueue.status, 'open')));

  const rows = [
    ...result.nieuwe_personen.map((p) => ({
      sourceId: source.id,
      kind: 'persoon_onbekend',
      proposal: p as Record<string, unknown>,
      question:
        `${p.naam} komt in deze bron voor maar staat niet in de personenlijst` +
        `${p.rol ? `, als ${p.rol}` : ''}${p.organisatie ? ` bij ${p.organisatie}` : ''}. ` +
        `Aanmaken?`,
      confidence: p.confidence.toFixed(2),
    })),
    ...result.triage.map((t) => ({
      sourceId: source.id,
      kind: t.kind,
      proposal: t.voorstel,
      question: t.vraag,
      confidence: t.confidence.toFixed(2),
    })),
  ];

  if (rows.length > 0) await db.insert(triageQueue).values(rows);
}
