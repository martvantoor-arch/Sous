import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ontbreekt');

const { sql, db } = createDb(url, { max: 1 });
await migrate(db, { migrationsFolder: join(here, '..', 'migrations') });
await sql.end();
console.log('migraties uitgevoerd');
