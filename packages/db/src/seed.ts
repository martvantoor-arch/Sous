// CLI: pnpm db:seed. SEED_FORCE=1 om ook op een gevulde database te draaien.
import { createDb } from './client.js';
import { seedIfEmpty } from './setup.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ontbreekt');

const { sql, db } = createDb(url, { max: 1 });
const seeded = await seedIfEmpty(sql, db, { force: process.env.SEED_FORCE === '1' });
await sql.end();

console.log(
  seeded
    ? 'seed uitgevoerd'
    : 'database is al geseed, overgeslagen (SEED_FORCE=1 om toch te draaien)',
);
