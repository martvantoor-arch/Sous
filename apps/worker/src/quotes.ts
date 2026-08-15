// Controleert of elk citaat uit een extractie letterlijk in de bron staat.
// Dit is de enige harde eis uit docs/eval.md die machinaal te toetsen is: nul
// verzinsels. Een gemist punt kost een herinnering, een verzonnen punt kost het
// vertrouwen in het hele systeem.
import { getDb, sources, extractions, eq, desc } from '@meetinghub/db';

export interface QuoteCheck {
  title: string;
  promptVersion: string | null;
  checked: number;
  fabricated: number;
  problems: Array<{ path: string; fragment: string }>;
}

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

/** Toetst de nieuwste extractie van één bron. Null als er nog geen extractie is. */
export async function checkQuotes(sourceId: string): Promise<QuoteCheck> {
  const db = getDb();
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!source) throw new Error(`bron ${sourceId} bestaat niet`);

  const [latest] = await db
    .select({ result: extractions.result, promptVersion: extractions.promptVersion })
    .from(extractions)
    .where(eq(extractions.sourceId, sourceId))
    .orderBy(desc(extractions.createdAt))
    .limit(1);

  const check: QuoteCheck = {
    title: source.title ?? source.id,
    promptVersion: latest?.promptVersion ?? null,
    checked: 0,
    fabricated: 0,
    problems: [],
  };
  if (!latest) return check;

  const haystack = normalise(`${source.rawText}\n${source.summaryText ?? ''}`);
  for (const { path, quote } of collectQuotes(latest.result)) {
    for (const fragment of fragments(quote)) {
      check.checked++;
      if (!haystack.includes(normalise(fragment))) {
        check.fabricated++;
        check.problems.push({ path, fragment });
      }
    }
  }
  return check;
}
