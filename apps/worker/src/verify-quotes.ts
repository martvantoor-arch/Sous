// Controleert of elk citaat uit een extractie letterlijk in de bron staat.
// Dit is de enige harde eis uit docs/eval.md die je machinaal kunt toetsen:
// nul verzinsels. Een gemist punt kost een herinnering, een verzonnen punt
// kost het vertrouwen in het hele systeem.
//
//   node dist/verify-quotes.js [sourceId ...]     zonder argument: alle bronnen
import { getDb, sources, extractions, eq, desc, inArray } from '@meetinghub/db';

/**
 * Het transcript zet elke beurt tussen `Speaker:` regels. Een citaat dat twee
 * opeenvolgende beurten beslaat is dus geen aaneengesloten string in de bron.
 * Die markers en de paginakoppen van de Pocket export horen niet bij de tekst.
 */
function normalise(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/^\s*Speaker:\s*$/gim, ' ')
    .replace(/Your personal AI assistant Page \d+ of \d+/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Citaten mogen een weglating bevatten; elk deel wordt apart getoetst. */
function fragments(quote: string): string[] {
  return quote
    .split('...')
    .map((f) => f.trim())
    .filter((f) => normalise(f).length > 12);
}

function collectQuotes(node: unknown, path = ''): Array<{ path: string; quote: string }> {
  const found: Array<{ path: string; quote: string }> = [];
  if (Array.isArray(node)) {
    node.forEach((v, i) => found.push(...collectQuotes(v, `${path}[${i}]`)));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'citaat' || key === 'bewijs_citaat') && typeof value === 'string' && value.trim()) {
        found.push({ path: `${path}.${key}`, quote: value });
      } else {
        found.push(...collectQuotes(value, path ? `${path}.${key}` : key));
      }
    }
  }
  return found;
}

const db = getDb();
const wanted = process.argv.slice(2);

const rows = await db
  .select({
    id: sources.id,
    title: sources.title,
    rawText: sources.rawText,
    summaryText: sources.summaryText,
  })
  .from(sources)
  .where(wanted.length ? inArray(sources.id, wanted) : undefined);

let totalBad = 0;

for (const source of rows) {
  const [latest] = await db
    .select({ result: extractions.result, promptVersion: extractions.promptVersion })
    .from(extractions)
    .where(eq(extractions.sourceId, source.id))
    .orderBy(desc(extractions.createdAt))
    .limit(1);
  if (!latest) continue;

  const haystack = normalise(`${source.rawText}\n${source.summaryText ?? ''}`);
  const quotes = collectQuotes(latest.result);

  let checked = 0;
  let bad = 0;
  for (const { path, quote } of quotes) {
    for (const fragment of fragments(quote)) {
      checked++;
      if (!haystack.includes(normalise(fragment))) {
        bad++;
        console.error(`  VERZONNEN  ${path}: ${fragment.slice(0, 100)}`);
      }
    }
  }
  totalBad += bad;
  const verdict = bad === 0 ? 'schoon' : `${bad} VERZONNEN`;
  console.log(
    `${source.title ?? source.id} (${latest.promptVersion}): ` +
      `${checked - bad}/${checked} citaatfragmenten letterlijk in de bron — ${verdict}`,
  );
}

process.exit(totalBad === 0 ? 0 : 1);
