// Inrichten van een database: migraties draaien en, als hij nog leeg is, het
// woordenboek erin zetten. Als functies, zodat zowel de CLI als de worker bij
// het opstarten dezelfde weg gebruiken.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb, type Database } from './client.js';
import { projects } from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Willekeurig maar vast getal. Twee processen die tegelijk opstarten pakken
 * dezelfde lock, zodat er nooit twee migratielopen door elkaar draaien.
 */
const MIGRATION_LOCK = 4_071_983_211;

type Sql = ReturnType<typeof createDb>['sql'];

export async function migrateToLatest(sql: Sql, db: Database): Promise<void> {
  await sql`select pg_advisory_lock(${MIGRATION_LOCK})`;
  try {
    await migrate(db, { migrationsFolder: join(here, '..', 'migrations') });
  } finally {
    await sql`select pg_advisory_unlock(${MIGRATION_LOCK})`;
  }
}

/**
 * Draait db/seed.sql. Dat bestand is idempotent: elke insert slaat over wat er
 * al staat. Zo blijft het de onderhouden bron voor het woordenboek, de personen
 * en de projecten — voeg een term toe en de volgende deploy zet hem erin.
 *
 * Het overschrijft nooit iets. Wijzig je een bestaande regel in seed.sql, dan
 * moet je die met de hand bijwerken; dat is expres, want deze tabellen groeien
 * ook via de triage wachtrij.
 */
export async function runSeed(sql: Sql, db: Database): Promise<{ added: number }> {
  const before = await db.select({ id: projects.id }).from(projects);
  const seedPath = join(here, '..', '..', '..', 'db', 'seed.sql');
  await sql.unsafe(await readFile(seedPath, 'utf8'));
  const after = await db.select({ id: projects.id }).from(projects);
  return { added: after.length - before.length };
}

/** Migreren en zo nodig seeden, op een eigen verbinding. */
export async function provision(url: string): Promise<void> {
  const { sql, db } = createDb(url, { max: 1 });
  try {
    await migrateToLatest(sql, db);
    await runSeed(sql, db);
    console.log('database ingericht: migraties gedraaid, referentiedata bijgewerkt');
  } finally {
    await sql.end();
  }
}
