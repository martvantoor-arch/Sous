// Draait één keer bij het opstarten van de webserver.
//
// Waarom dit hier moet staan: de migraties draaiden alleen in de worker. Zolang
// web en worker hetzelfde tempo hielden viel dat niet op, maar het is een
// verkapte afhankelijkheid — de webapp werkte pas als een ánder proces was
// opgestart. Bij de login liep dat mis: de pagina stond er, de tabel niet, en
// inloggen viel om op `relation "login_tokens" does not exist`.
//
// Twee processen die tegelijk migreren is geen probleem: `migrateToLatest` pakt
// een advisory lock, dus wie als tweede komt wacht en ziet daarna dat er niets
// meer te doen is.
//
// Alleen migreren, niet seeden. De referentiedata is van de worker; die hoort
// niet vanuit een webverzoek te verschijnen.
export async function register(): Promise<void> {
  // Alleen op de server-runtime; de edge-runtime heeft geen database.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[web] DATABASE_URL ontbreekt, migraties overgeslagen');
    return;
  }

  // `webpackIgnore` laat deze import staan zoals hij is. Zonder die aanwijzing
  // probeert webpack `@meetinghub/db` mee te bundelen voor de edge-runtime —
  // instrumentatie wordt voor beide runtimes gecompileerd zodra er middleware
  // is — en valt de build om op `node:crypto` en `node:fs`, die daar niet
  // bestaan. De controle hierboven zorgt dat dit alleen in Node draait.
  const { createDb, migrateToLatest } = await import(
    /* webpackIgnore: true */ '@meetinghub/db'
  );
  const { sql, db } = createDb(url, { max: 1 });
  try {
    await migrateToLatest(sql, db);
    console.log('[web] migraties bij');
  } catch (err) {
    // Niet fataal maken: een draaiende app met een mislukte migratie is beter
    // te onderzoeken dan een container die in een herstartlus zit.
    console.error('[web] migreren mislukt:', err);
  } finally {
    await sql.end();
  }
}
