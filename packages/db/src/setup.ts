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
 * Draait db/seed.sql, maar alleen op een lege database. Seeden op een gevulde
 * database zou dubbele termen opleveren, en het woordenboek is precies het ding
 * dat je met de hand bijhoudt.
 */
export async function seedIfEmpty(
  sql: Sql,
  db: Database,
  options: { force?: boolean } = {},
): Promise<boolean> {
  const existing = await db.select({ id: projects.id }).from(projects).limit(1);
  if (existing.length > 0 && !options.force) return false;

  const seedPath = join(here, '..', '..', '..', 'db', 'seed.sql');
  await sql.unsafe(await readFile(seedPath, 'utf8'));
  return true;
}

/** Migreren en zo nodig seeden, op een eigen verbinding. */
export async function provision(url: string): Promise<void> {
  const { sql, db } = createDb(url, { max: 1 });
  try {
    await migrateToLatest(sql, db);
    const seeded = await seedIfEmpty(sql, db);
    console.log(
      seeded
        ? 'database ingericht: migraties gedraaid, woordenboek geseed'
        : 'database ingericht: migraties gedraaid, seed overgeslagen (al gevuld)',
    );
  } finally {
    await sql.end();
  }
}
