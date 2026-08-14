import {
  getDb,
  sources,
  extractions,
  changeLog,
  eq,
  type Database,
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

  const [row] = await db
    .insert(extractions)
    .values({
      sourceId: source.id,
      promptVersion: prompt.version,
      model: EXTRACTION_MODEL,
      result,
    })
    .returning({ id: extractions.id });

  await markProcessed(db, source, result, prompt.version);

  return { sourceId: source.id, extractionId: row!.id, result };
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
  db: Database,
  source: SourceRow,
  result: Extraction,
  promptVersion: string,
): Promise<void> {
  const sensitive = result.gevoelig.length > 0;
  const linkProject =
    result.project.id !== null && result.project.confidence >= PROJECT_LINK_THRESHOLD;

  await db
    .update(sources)
    .set({
      processedAt: new Date(),
      promptVersion,
      model: EXTRACTION_MODEL,
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
