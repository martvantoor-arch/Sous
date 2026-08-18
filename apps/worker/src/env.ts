/**
 * Controleert bij het opstarten of alles er is wat de worker nodig heeft.
 *
 * Zonder deze check valt de worker om op een stacktrace uit de eerste module
 * die toevallig een variabele leest, en de sleutel voor Claude wordt pas
 * gemist bij de eerste extractie. Dan draait de worker vrolijk, en loopt de
 * wachtrij vol met jobs die drie keer proberen en falen.
 */
const REQUIRED: Array<{ name: string; hint: string }> = [
  { name: 'DATABASE_URL', hint: 'op Railway: ${{Postgres.DATABASE_URL}}' },
  { name: 'ANTHROPIC_API_KEY', hint: 'alleen op de worker, niet op web' },
];

/**
 * Wel nodig, maar niet om te starten.
 *
 * Zonder `RESEND_API_KEY` werkt alles behalve inkomende mail. Daarop stoppen
 * zou de extractie van meetings gijzelen voor een functie die je misschien nog
 * niet gebruikt. Een waarschuwing bij het opstarten is genoeg — en die staat er
 * wel, want anders merk je het pas als de eerste doorgestuurde mail in de
 * wachtrij blijft hangen.
 */
const AANBEVOLEN: Array<{ name: string; waarvoor: string }> = [
  { name: 'RESEND_API_KEY', waarvoor: 'de body van een inkomende mail ophalen' },
];

export function requireEnv(): void {
  for (const { name, waarvoor } of AANBEVOLEN) {
    if (!process.env[name]?.trim()) {
      console.warn(`let op: ${name} ontbreekt. Werkt niet: ${waarvoor}.`);
    }
  }

  const missing = REQUIRED.filter(({ name }) => !process.env[name]?.trim());
  if (missing.length === 0) return;

  console.error('De worker kan niet starten, deze omgevingsvariabelen ontbreken:\n');
  for (const { name, hint } of missing) console.error(`  ${name}  —  ${hint}`);
  console.error('\nZet ze op de worker service en deploy opnieuw.');
  process.exit(1);
}
