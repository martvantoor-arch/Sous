// Pocket levert per opname een samenvatting en een transcript. Deze route doet
// twee dingen en niet meer: de ruwe bron onaangetast wegschrijven, en de
// verwerking in de wachtrij zetten. Extractie hoort niet in een webhook.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb, sources, eq } from '@meetinghub/db';
import { enqueueExtraction } from '@meetinghub/core';
import { pocketPayloadSchema } from '@/lib/pocket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Naam van de header waar Pocket de handtekening in zet. Aanpasbaar omdat de
 * exacte naam per Pocket-configuratie kan verschillen; de vorm is HMAC-SHA256
 * over de ruwe body, hex, eventueel met `sha256=` ervoor.
 */
const SIGNATURE_HEADER = process.env.POCKET_SIGNATURE_HEADER ?? 'x-pocket-signature';

export async function POST(request: Request) {
  const secret = process.env.POCKET_WEBHOOK_SECRET;
  if (!secret) {
    // Dicht falen: liever geen ingest dan een open endpoint.
    console.error('POCKET_WEBHOOK_SECRET ontbreekt, webhook geweigerd');
    return NextResponse.json({ error: 'webhook niet geconfigureerd' }, { status: 503 });
  }

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get(SIGNATURE_HEADER), secret)) {
    return NextResponse.json({ error: 'ongeldige handtekening' }, { status: 401 });
  }

  let payload;
  try {
    payload = pocketPayloadSchema.parse(JSON.parse(raw));
  } catch (err) {
    return NextResponse.json(
      { error: 'payload niet herkend', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const db = getDb();
  const externalId = `pocket:${payload.externalId}`;

  const inserted = await db
    .insert(sources)
    .values({
      type: 'meeting',
      externalId,
      title: payload.title,
      occurredAt: payload.occurredAt,
      durationSec: payload.durationSec,
      rawText: payload.transcript,
      summaryText: payload.summary,
      providerActions: payload.actionItems,
    })
    .onConflictDoNothing({ target: sources.externalId })
    .returning({ id: sources.id });

  const existing = inserted[0];
  if (!existing) {
    // Pocket levert soms dubbel. De eerste levering telt.
    const [known] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.externalId, externalId));
    return NextResponse.json({ sourceId: known?.id ?? null, status: 'reeds ontvangen' });
  }

  await enqueueExtraction({ sourceId: existing.id });

  return NextResponse.json({ sourceId: existing.id, status: 'in wachtrij' }, { status: 202 });
}

function verifySignature(body: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = header.startsWith('sha256=') ? header.slice(7) : header;
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  const a = Buffer.from(provided, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
