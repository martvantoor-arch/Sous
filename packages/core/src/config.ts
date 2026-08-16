/**
 * Model en prijzen op een plek. De prijzen staan hier omdat we per call de
 * kosten wegschrijven; zonder tabel kun je een promptwijziging niet afzetten
 * tegen wat hij kost.
 */

/** Welke promptversie de extractie gebruikt. Vastleggen bij elke run. */
export const EXTRACTION_PROMPT = (process.env.EXTRACTION_PROMPT ??
  'extract-v3') as 'extract-v1' | 'extract-v2' | 'extract-v3';

export const EXTRACTION_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

/** Effort voor de extractie. De kwaliteitseis is nul verzinsels, dus niet zuinig. */
export const EXTRACTION_EFFORT = (process.env.ANTHROPIC_EFFORT ??
  'high') as 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Ruim genoeg voor denkwerk plus een volledige extractie van een lange meeting. */
export const EXTRACTION_MAX_TOKENS = 32_000;

/** Dollar per miljoen tokens. */
type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

const PRICES: Record<string, Price> = {
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

/**
 * Kosten in dollarcent. Onbekend model levert null op: liever geen getal dan
 * een verzonnen getal.
 */
export function costInCents(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  },
): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const perToken = (dollarsPerMillion: number, tokens: number) =>
    (dollarsPerMillion * tokens) / 1_000_000;
  const dollars =
    perToken(p.input, usage.input_tokens) +
    perToken(p.output, usage.output_tokens) +
    perToken(p.cacheRead, usage.cache_read_input_tokens ?? 0) +
    perToken(p.cacheWrite, usage.cache_creation_input_tokens ?? 0);
  return dollars * 100;
}
