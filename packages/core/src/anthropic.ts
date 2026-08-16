import Anthropic from '@anthropic-ai/sdk';
import { getDb, llmCalls } from '@meetinghub/db';
import { costInCents } from './config.js';

let client: Anthropic | undefined;

export function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY ontbreekt');
    client = new Anthropic();
  }
  return client;
}

export interface CallOptions {
  model: string;
  maxTokens: number;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Stabiel deel van de systeemprompt; hierop zetten we het cachepunt. */
  systemBlocks: string[];
  userText: string;
  /** Voor de logregel. */
  kind: 'extractie' | 'reconciliatie';
  promptVersion: string;
  /** Vingerafdruk van de systeemprompt, zodat de logregel de tekst vastlegt en niet alleen de naam. */
  promptFingerprint?: string;
  sourceId?: string;
}

export interface CallResult {
  text: string;
  stopReason: string | null;
}

/**
 * Eén Claude call, met de logregel eromheen. Elke call legt promptversie,
 * model, tokens, duur en kosten vast, ook als hij mislukt: zonder de mislukte
 * runs zie je niet waar een prompt zwak is.
 */
export async function callClaude(opts: CallOptions): Promise<CallResult> {
  const started = Date.now();
  const db = getDb();
  let logged = false;

  try {
    const stream = getClient().messages.stream({
      model: opts.model,
      max_tokens: opts.maxTokens,
      output_config: { effort: opts.effort },
      system: opts.systemBlocks.map((text, i) => ({
        type: 'text' as const,
        text,
        // Cachepunt op het laatste blok: prompt en woordenboek zijn stabiel,
        // de bron wisselt per call en staat daarom in het user bericht.
        ...(i === opts.systemBlocks.length - 1
          ? { cache_control: { type: 'ephemeral' as const } }
          : {}),
      })),
      messages: [{ role: 'user', content: opts.userText }],
    });

    const message = await stream.finalMessage();
    const durationMs = Date.now() - started;

    await db.insert(llmCalls).values({
      sourceId: opts.sourceId ?? null,
      kind: opts.kind,
      promptVersion: opts.promptVersion,
      promptFingerprint: opts.promptFingerprint ?? null,
      model: opts.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      durationMs,
      costUsdCents: centsToNumeric(costInCents(opts.model, message.usage)),
      stopReason: message.stop_reason,
    });
    logged = true;

    if (message.stop_reason === 'refusal') {
      throw new Error('Claude weigerde deze bron te verwerken');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Antwoord afgekapt op max_tokens; verhoog EXTRACTION_MAX_TOKENS');
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return { text, stopReason: message.stop_reason };
  } catch (err) {
    // Alleen loggen als de call zelf omviel; bij een geslaagde call met een
    // slechte stop_reason staat de regel er al.
    if (!logged) {
      await db
        .insert(llmCalls)
        .values({
          sourceId: opts.sourceId ?? null,
          kind: opts.kind,
          promptVersion: opts.promptVersion,
          promptFingerprint: opts.promptFingerprint ?? null,
          model: opts.model,
          durationMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        })
        .catch(() => {
          /* het loggen mag de fout zelf niet verdringen */
        });
    }
    throw err;
  }
}

function centsToNumeric(cents: number | null): string | null {
  return cents === null ? null : cents.toFixed(4);
}
