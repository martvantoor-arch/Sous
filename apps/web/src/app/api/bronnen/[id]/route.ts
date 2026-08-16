// Machineleesbare weergave van een bron en zijn nieuwste extractie. Bedoeld om
// een evaluatierun uit te lezen vanaf een plek die niet bij de database kan.
//
// Staat dicht tenzij API_TOKEN gezet is. Er is nog geen login op deze app, dus
// een open endpoint zou transcripten aan iedereen met de URL geven.
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb, sources, extractions, llmCalls, eq, desc } from '@meetinghub/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = process.env.API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'API_TOKEN niet geconfigureerd' }, { status: 404 });
  }
  if (!authorised(request.headers.get('authorization'), token)) {
    return NextResponse.json({ error: 'niet geautoriseerd' }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'geen geldige id' }, { status: 400 });

  const db = getDb();
  const [source] = await db.select().from(sources).where(eq(sources.id, id));
  if (!source) return NextResponse.json({ error: 'bron bestaat niet' }, { status: 404 });

  const [latest] = await db
    .select()
    .from(extractions)
    .where(eq(extractions.sourceId, id))
    .orderBy(desc(extractions.createdAt))
    .limit(1);

  // De kostenregels horen erbij: zonder tokens en prijs kun je een
  // promptwijziging niet afzetten tegen wat hij kost.
  const calls = await db
    .select()
    .from(llmCalls)
    .where(eq(llmCalls.sourceId, id))
    .orderBy(desc(llmCalls.createdAt));

  return NextResponse.json({
    calls: calls.map((c) => ({
      soort: c.kind,
      promptVersie: c.promptVersion,
      // De vingerafdruk hoort erbij: twee runs met dezelfde versienaam kunnen
      // een andere prompttekst hebben gedraaid als er een deploy tussen zat.
      promptVingerafdruk: c.promptFingerprint,
      model: c.model,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      cacheReadTokens: c.cacheReadTokens,
      cacheWriteTokens: c.cacheWriteTokens,
      duurMs: c.durationMs,
      kostenDollarcent: c.costUsdCents,
      stopReason: c.stopReason,
      fout: c.error,
    })),
    bron: {
      id: source.id,
      titel: source.title,
      type: source.type,
      occurredAt: source.occurredAt,
      verwerktOp: source.processedAt,
      promptVersie: source.promptVersion,
      model: source.model,
      gevoelig: source.sensitive,
      gevoeligReden: source.sensitiveReason,
      // De ruwe tekst gaat mee: zonder de bron kun je de citaten niet toetsen,
      // en dat is de enige harde eis uit de evaluatieset.
      samenvatting: source.summaryText,
      transcript: source.rawText,
    },
    extractie: latest
      ? {
          id: latest.id,
          promptVersie: latest.promptVersion,
          model: latest.model,
          gedraaidOp: latest.createdAt,
          resultaat: latest.result,
        }
      : null,
  });
}

function authorised(header: string | null, token: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
