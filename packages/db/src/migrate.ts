// CLI: pnpm db:migrate
import { createDb } from './client.js';
import { migrateToLatest } from './setup.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ontbreekt');

const { sql, db } = createDb(url, { max: 1 });
await migrateToLatest(sql, db);
await sql.end();
console.log('migraties uitgevoerd');
