import {
  getDb,
  sources,
  projects,
  extractions,
  changeLog,
  eq,
  type DbOrTx,
} from '@meetinghub/db';
import { callClaude } from '../anthropic.js';
import {
  EXTRACTION_EFFORT,
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_MODEL,
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

  const [prompt, context] = await Promise.all([loadPrompt('extract-v1'), buildContext()]);

  const { text } = await callClaude({
    model: EXTRACTION_MODEL,
    maxTokens: EXTRACTION_MAX_TOKENS,
    effort: EXTRACTION_EFFORT,
    systemBlocks: [prompt.system, context.text],
    userText: renderSource(source),
    kind: 'extractie',
    promptVersion: prompt.version,
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
    source.rawText,
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

async function markProcessed(
  db: DbOrTx,
  source: SourceRow,
  result: Extraction,
  meta: { promptVersion: string; model: string },
): Promise<void> {
  const sensitive = result.gevoelig.length > 0;

  // Het model hoort alleen te koppelen aan een project dat het meekreeg, maar
  // een verzonnen of verouderde uuid mag de hele bron niet laten omvallen.
  // Bestaat hij niet, dan koppelen we niet: liever geen koppeling dan een
  // verkeerde, en de ruwe extractie blijft staan om opnieuw te draaien.
  let linkProject =
    result.project.id !== null && result.project.confidence >= PROJECT_LINK_THRESHOLD;
  if (linkProject) {
    const [known] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, result.project.id!));
    if (!known) {
      console.warn(
        `bron ${source.id}: project ${result.project.id} bestaat niet, niet gekoppeld ` +
          `(genoemd als "${result.project.naam_raw}")`,
      );
      linkProject = false;
    }
  }

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
      ...(linkProject
        ? {
            projectId: result.project.id,
            projectConf: result.project.confidence.toFixed(2),
          }
        : {}),
    })
    .where(eq(sources.id, source.id));

  if (linkProject && result.project.id !== source.projectId) {
    await db.insert(changeLog).values({
      entityType: 'source',
      entityId: source.id,
      field: 'project_id',
      oldValue: source.projectId,
      newValue: result.project.id,
      sourceId: source.id,
      origin: 'extractie',
      quote: result.project.naam_raw || null,
    });
  }
}
