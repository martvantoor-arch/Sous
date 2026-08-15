// CLI: pnpm db:seed. Idempotent; voegt alleen toe wat er nog niet staat.
import { createDb } from './client.js';
import { runSeed } from './setup.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ontbreekt');

const { sql, db } = createDb(url, { max: 1 });
const { added } = await runSeed(sql, db);
await sql.end();
console.log(`seed uitgevoerd, ${added} nieuwe projecten`);
