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

export function requireEnv(): void {
  const missing = REQUIRED.filter(({ name }) => !process.env[name]?.trim());
  if (missing.length === 0) return;

  console.error('De worker kan niet starten, deze omgevingsvariabelen ontbreken:\n');
  for (const { name, hint } of missing) console.error(`  ${name}  —  ${hint}`);
  console.error('\nZet ze op de worker service en deploy opnieuw.');
  process.exit(1);
}
