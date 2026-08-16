// TIJDELIJKE ONDERHOUDSROUTE — bedoeld om één keer gebruikt te worden en
// daarna verwijderd.
//
// Reden van bestaan: de database staat achter een Railway-proxy die alleen
// vanaf de services zelf bereikbaar is. Er is geen andere weg om de ruwe
// transcripten op te ruimen zonder een shell op die omgeving.
//
// Staat dicht tenzij API_TOKEN gezet is, vraagt om een expliciete bevestiging
// in de body, en doet standaard niets: zonder `"toepassen": true` krijg je
// alleen te zien wat er zou gebeuren.
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb, purgeTranscripts, type PurgeScope } from '@meetinghub/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Zonder dit woord in de body gebeurt er niets, ook niet met een geldig token. */
const BEVESTIGING = 'ja, verwijder de ruwe tekst';

export async function POST(request: Request) {
  const token = process.env.API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'API_TOKEN niet geconfigureerd' }, { status: 404 });
  }
  if (!authorised(request.headers.get('authorization'), token)) {
    return NextResponse.json({ error: 'niet geautoriseerd' }, { status: 401 });
  }

  let body: { selectie?: string; maanden?: number; toepassen?: boolean; bevestiging?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body is geen geldige JSON' }, { status: 400 });
  }

  let scope: PurgeScope;
  switch (body.selectie) {
    case 'fixtures':
      scope = { kind: 'fixtures' };
      break;
    case 'ouder-dan':
      if (!Number.isFinite(body.maanden) || (body.maanden ?? 0) <= 0) {
        return NextResponse.json({ error: 'maanden ontbreekt of is ongeldig' }, { status: 400 });
      }
      scope = { kind: 'olderThanMonths', months: body.maanden! };
      break;
    case 'alles':
      scope = { kind: 'all' };
      break;
    default:
      return NextResponse.json(
        { error: 'selectie moet fixtures, ouder-dan of alles zijn' },
        { status: 400 },
      );
  }

  const toepassen = body.toepassen === true;
  if (toepassen && body.bevestiging !== BEVESTIGING) {
    return NextResponse.json(
      { error: `bevestiging ontbreekt; stuur exact: ${BEVESTIGING}` },
      { status: 400 },
    );
  }

  const result = await purgeTranscripts(getDb(), scope, { apply: toepassen });

  return NextResponse.json({
    proefrun: !toepassen,
    gevonden: result.gevonden.length,
    geleegd: result.geleegd,
    tekensVerwijderd: result.tekensVerwijderd,
    bronnen: result.gevonden.map((b) => ({
      externalId: b.externalId,
      titel: b.titel,
      tekens: Number(b.tekens),
    })),
  });
}

function authorised(header: string | null, token: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
