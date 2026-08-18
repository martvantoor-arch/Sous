// Inkomende mail van Resend.
//
// Marten stuurt een mail door naar `marten+blk@…` en die komt hier binnen. De
// route doet twee dingen en niet meer: controleren dat het echt Resend is, en
// de envelop wegschrijven. De body wordt apart opgehaald — die zit niet in de
// webhook — en de extractie draait pas als die er is.
//
// Zelfde vorm als de Pocket-webhook: dicht falen als het geheim ontbreekt,
// liever geen ingest dan een open eindpunt waar iedereen bronnen in kan
// duwen.
import { NextResponse } from 'next/server';
import {
  controleerSvix,
  inboundMailSchema,
  leesSvixHeaders,
  ontvangMail,
  ONTVANGEN,
} from '@meetinghub/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RESEND_WEBHOOK_SECRET ontbreekt, mailwebhook geweigerd');
    return NextResponse.json({ error: 'webhook niet geconfigureerd' }, { status: 503 });
  }

  const raw = await request.text();
  const reden = controleerSvix(raw, leesSvixHeaders(request.headers), secret);
  if (reden) {
    // De reden hoort in de log, niet in het antwoord.
    console.warn(`[mail] levering geweigerd: ${reden}`);
    return NextResponse.json({ error: 'ongeldige handtekening' }, { status: 401 });
  }

  let payload;
  try {
    payload = inboundMailSchema.parse(JSON.parse(raw));
  } catch (err) {
    return NextResponse.json(
      { error: 'payload niet herkend', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  // Over ditzelfde eindpunt komen ook de bezorgstatussen van de inloglinks
  // binnen. Die zijn geen bron. 200 en niet 400: het is een geldige levering
  // die wij alleen niet nodig hebben, en Svix hoort hem niet te herhalen.
  if (payload.type !== ONTVANGEN) {
    return NextResponse.json({ status: 'genegeerd', type: payload.type });
  }

  const ontvangst = await ontvangMail(payload);

  return NextResponse.json(ontvangst, {
    status: ontvangst.status === 'in wachtrij' ? 202 : 200,
  });
}
