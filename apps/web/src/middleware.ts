// Alles staat dicht, behalve wat expliciet open moet.
//
// Deze volgorde is met opzet: een nieuwe pagina is vanaf nu automatisch
// beschermd. Was het andersom — een lijst met wat dicht moet — dan was elke
// nieuwe route een gat tot iemand eraan dacht.
//
// De middleware kijkt alleen of er een sessiecookie is, niet of hij geldig is.
// Dat kan hier niet: middleware draait op de edge-runtime en heeft geen
// database. De echte controle staat in `huidigeGebruiker()`, die de layout bij
// elk verzoek doet. Deze laag is er om iemand zonder cookie meteen naar het
// inlogscherm te sturen, niet als het slot zelf.
import { NextResponse, type NextRequest } from 'next/server';

const SESSIE_COOKIE = 'meetinghub_sessie';

/**
 * Routes die hun eigen slot meebrengen en dus geen sessie nodig hebben:
 *
 * - `/login` en `/login/verifieer` — daar kom je nog binnen zonder sessie.
 * - `/api/ingest/pocket` en `/api/ingest/mail` — Pocket en Resend kunnen niet
 *   inloggen; die routes controleren een HMAC-handtekening over de body, wat
 *   sterker is dan een sessiecookie.
 * - `/api/bronnen` en `/api/toezeggingen` — lezen af achter een bearer-token,
 *   voor de evaluatieruns. Alleen lezen, en zonder token bestaan ze niet.
 */
const OPEN: RegExp[] = [
  /^\/login(\/|$)/,
  /^\/api\/ingest\/(pocket|mail)$/,
  /^\/api\/bronnen\//,
  /^\/api\/toezeggingen$/,
];

export function middleware(request: NextRequest) {
  const pad = request.nextUrl.pathname;

  if (OPEN.some((patroon) => patroon.test(pad))) return NextResponse.next();
  if (request.cookies.has(SESSIE_COOKIE)) return NextResponse.next();

  const naarLogin = new URL('/login', request.url);
  return NextResponse.redirect(naarLogin);
}

export const config = {
  // Statische bestanden en het favicon hoeven hier niet doorheen.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
