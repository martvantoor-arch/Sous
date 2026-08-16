// Inloggen met een magic link.
//
// Waarom geen wachtwoord: dit is een persoonlijke hub met één gebruiker. Een
// wachtwoord zou een extra geheim zijn om kwijt te raken, terwijl de mailbox
// toch al de herstelweg is. De mail is dus meteen het bewijs.
//
// Drie regels waar de rest uit volgt:
//
// 1. **Alleen adressen uit `AUTH_ALLOWED_EMAILS` mogen inloggen.** Zonder die
//    lijst kan iedereen die het adres raadt een link naar zichzelf sturen.
// 2. **We bewaren nooit een token, alleen de sha256 ervan.** Wie de database
//    leest kan er dan geen werkende link of cookie uit terugbouwen.
// 3. **Een link is eenmalig en verloopt.** Allebei nodig: zonder eenmaligheid
//    blijft een link uit een oude mailbox werken, zonder verlooptijd blijft een
//    nooit gebruikte link eeuwig geldig.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { getDb, authSessions, loginTokens, and, eq, isNull, sql } from '@meetinghub/db';

export const SESSIE_COOKIE = 'meetinghub_sessie';

/** Kort genoeg om een onderschepte link waardeloos te maken, lang genoeg om de mail te halen. */
const LINK_GELDIG_MINUTEN = 15;
/** Lang genoeg om niet elke dag opnieuw te hoeven inloggen. */
const SESSIE_GELDIG_DAGEN = 30;

function hash(waarde: string): string {
  return createHash('sha256').update(waarde).digest('hex');
}

/** Wie er mag inloggen. Leeg betekent: niemand, en dat is de veilige stand. */
export function toegestaneAdressen(): string[] {
  return (process.env.AUTH_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Vergelijkt in constante tijd, zodat het antwoord niet verraadt hoeveel
 * karakters klopten. Overdreven voor een lijst van één adres, maar het is één
 * regel en de gewoonte is het waard.
 */
export function isToegestaan(email: string): boolean {
  const genormaliseerd = email.trim().toLowerCase();
  return toegestaneAdressen().some((toegestaan) => {
    const a = Buffer.from(genormaliseerd);
    const b = Buffer.from(toegestaan);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** Maakt een eenmalige inloglink en geeft het token terug om te mailen. */
export async function maakLoginToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const verlooptOp = new Date(Date.now() + LINK_GELDIG_MINUTEN * 60_000);

  await getDb().insert(loginTokens).values({
    email: email.trim().toLowerCase(),
    tokenHash: hash(token),
    expiresAt: verlooptOp,
  });

  return token;
}

/**
 * Wisselt een geldig token in voor een sessie en zet het cookie.
 *
 * Geeft `null` bij een token dat niet bestaat, al gebruikt is of verlopen. Die
 * drie geven met opzet dezelfde uitkomst: een aanvaller hoort niet te leren
 * welke van de drie het was.
 */
export async function wisselTokenIn(token: string): Promise<string | null> {
  const db = getDb();
  const nu = new Date();

  // Meteen als gebruikt markeren, in dezelfde query als het ophalen. Twee
  // gelijktijdige verzoeken met hetzelfde token leveren zo maar één sessie op.
  const [rij] = await db
    .update(loginTokens)
    .set({ usedAt: nu })
    .where(
      and(
        eq(loginTokens.tokenHash, hash(token)),
        isNull(loginTokens.usedAt),
        sql`${loginTokens.expiresAt} > now()`,
      ),
    )
    .returning({ email: loginTokens.email });

  if (!rij) return null;

  const sessieToken = randomBytes(32).toString('base64url');
  const verlooptOp = new Date(Date.now() + SESSIE_GELDIG_DAGEN * 86_400_000);

  await db.insert(authSessions).values({
    email: rij.email,
    tokenHash: hash(sessieToken),
    expiresAt: verlooptOp,
    lastSeenAt: nu,
    userAgent: (await headers()).get('user-agent')?.slice(0, 200) ?? null,
  });

  (await cookies()).set(SESSIE_COOKIE, sessieToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: verlooptOp,
  });

  return rij.email;
}

/** Het e-mailadres van de ingelogde gebruiker, of null. */
export async function huidigeGebruiker(): Promise<string | null> {
  const token = (await cookies()).get(SESSIE_COOKIE)?.value;
  if (!token) return null;

  const [rij] = await getDb()
    .select({ id: authSessions.id, email: authSessions.email })
    .from(authSessions)
    .where(and(eq(authSessions.tokenHash, hash(token)), sql`${authSessions.expiresAt} > now()`));

  if (!rij) return null;

  // Het adres kan uit de lijst gehaald zijn nadat de sessie is gemaakt. Dan is
  // de sessie niet meer geldig, ook al is hij nog niet verlopen.
  if (!isToegestaan(rij.email)) return null;

  return rij.email;
}

/** Uitloggen: sessie weg uit de database én het cookie weg. */
export async function logUit(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSIE_COOKIE)?.value;
  if (token) {
    await getDb().delete(authSessions).where(eq(authSessions.tokenHash, hash(token)));
  }
  jar.delete(SESSIE_COOKIE);
}
