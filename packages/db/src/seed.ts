// Draait db/seed.sql. Idempotent gemaakt door eerst te kijken of er al
// projecten staan: seeden op een gevulde database zou dubbele termen opleveren.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDb } from './client.js';
import { projects } from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ontbreekt');

const { sql, db } = createDb(url, { max: 1 });

const existing = await db.select({ id: projects.id }).from(projects).limit(1);
if (existing.length > 0 && process.env.SEED_FORCE !== '1') {
  console.log('database is al geseed, overgeslagen (SEED_FORCE=1 om toch te draaien)');
} else {
  const seedPath = join(here, '..', '..', '..', 'db', 'seed.sql');
  await sql.unsafe(await readFile(seedPath, 'utf8'));
  console.log('seed uitgevoerd');
}

await sql.end();
