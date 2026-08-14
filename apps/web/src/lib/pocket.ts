// Pocket's veldnamen liggen niet vast tussen exportvarianten. We accepteren de
// bekende schrijfwijzen en normaliseren naar één vorm; alles wat we niet
// herkennen laten we hard falen in plaats van er een lege bron van te maken.
import { z } from 'zod';

const firstString = (...values: unknown[]): string | undefined => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v;
  }
  return undefined;
};

const firstNumber = (...values: unknown[]): number | undefined => {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
};

const rawSchema = z
  .object({
    id: z.unknown(),
    recording_id: z.unknown(),
    title: z.unknown(),
    name: z.unknown(),
    summary: z.unknown(),
    summary_text: z.unknown(),
    transcript: z.unknown(),
    transcript_text: z.unknown(),
    text: z.unknown(),
    action_items: z.unknown(),
    actionItems: z.unknown(),
    recorded_at: z.unknown(),
    created_at: z.unknown(),
    started_at: z.unknown(),
    duration: z.unknown(),
    duration_sec: z.unknown(),
    duration_seconds: z.unknown(),
  })
  .partial()
  .passthrough();

export interface PocketPayload {
  externalId: string;
  title: string | null;
  summary: string | null;
  transcript: string;
  actionItems: unknown;
  occurredAt: Date;
  durationSec: number | null;
}

export const pocketPayloadSchema = rawSchema.transform((v, ctx): PocketPayload => {
  const fail = (message: string) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    return z.NEVER;
  };

  const externalId = firstString(v.id, v.recording_id);
  if (!externalId) return fail('geen id of recording_id in payload');

  const transcript = firstString(v.transcript, v.transcript_text, v.text);
  if (!transcript) return fail('geen transcript in payload');

  const occurredRaw = firstString(v.recorded_at, v.started_at, v.created_at);
  const occurredAt = occurredRaw ? new Date(occurredRaw) : new Date();
  if (Number.isNaN(occurredAt.getTime())) return fail(`datum niet leesbaar: ${occurredRaw}`);

  return {
    externalId,
    title: firstString(v.title, v.name) ?? null,
    summary: firstString(v.summary, v.summary_text) ?? null,
    transcript,
    actionItems: v.action_items ?? v.actionItems ?? null,
    occurredAt,
    durationSec: firstNumber(v.duration_sec, v.duration_seconds, v.duration) ?? null,
  };
});
