// Handtekeningcontrole voor de webhooks van Resend.
//
// Resend gebruikt Svix, en dat is een vast recept: HMAC-SHA256 over
// `<svix-id>.<svix-timestamp>.<body>`, met de sleutel die achter `whsec_`
// staat, base64. Zelf gedaan in plaats van met de SDK — het is vijftien
// regels, en één afhankelijkheid minder in een route die van buiten
// bereikbaar is.
//
// Twee dingen die net zo belangrijk zijn als de hash zelf:
//
// - De tijdstempel wordt gecontroleerd. Zonder die controle kan iemand die één
//   geldige levering onderschept hem eeuwig blijven afspelen.
// - De vergelijking is tijdconstant. Een vergelijking die bij het eerste
//   verschil stopt lekt, meting na meting, hoe ver je gokje goed was.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Svix weigert leveringen die ouder zijn dan vijf minuten. Wij ook. */
const SPELING_SECONDEN = 5 * 60;

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export function leesSvixHeaders(headers: Headers): SvixHeaders {
  return {
    id: headers.get('svix-id') ?? headers.get('webhook-id'),
    timestamp: headers.get('svix-timestamp') ?? headers.get('webhook-timestamp'),
    signature: headers.get('svix-signature') ?? headers.get('webhook-signature'),
  };
}

/**
 * Geeft null terug als de handtekening klopt, anders de reden.
 *
 * Een reden en niet alleen `false`, zodat de log kan vertellen wát er mis was.
 * Die reden gaat nooit terug naar de afzender: wie een verkeerde handtekening
 * stuurt hoort niet te leren of hij warm was.
 */
export function controleerSvix(body: string, headers: SvixHeaders, secret: string): string | null {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return 'svix-headers ontbreken';
  }

  const tijdstip = Number(headers.timestamp);
  if (!Number.isFinite(tijdstip)) return 'tijdstempel niet leesbaar';

  const verschil = Math.abs(Date.now() / 1000 - tijdstip);
  if (verschil > SPELING_SECONDEN) {
    return `tijdstempel ${Math.round(verschil)}s uit de pas`;
  }

  // `whsec_` is een voorvoegsel, geen deel van de sleutel.
  const sleutel = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const verwacht = createHmac('sha256', sleutel)
    .update(`${headers.id}.${headers.timestamp}.${body}`, 'utf8')
    .digest('base64');

  // De header kan meerdere handtekeningen dragen, gescheiden door spaties,
  // elk met een versievoorvoegsel. Tijdens een sleutelwissel staan de oude en
  // de nieuwe er allebei in; één die klopt is genoeg.
  const aangeboden = headers.signature
    .split(' ')
    .map((deel) => deel.split(',', 2))
    .filter(([versie]) => versie === 'v1')
    .map(([, hash]) => hash ?? '');

  const klopt = aangeboden.some((hash) => gelijk(hash, verwacht));
  return klopt ? null : 'handtekening klopt niet';
}

function gelijk(a: string, b: string): boolean {
  const links = Buffer.from(a);
  const rechts = Buffer.from(b);
  return links.length === rechts.length && timingSafeEqual(links, rechts);
}
