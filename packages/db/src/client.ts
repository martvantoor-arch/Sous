import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDb>['db'];
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Voor functies die zowel los als binnen een transactie moeten werken. */
export type DbOrTx = Database | Transaction;

export function createDb(url: string, options?: { max?: number }) {
  const sql = postgres(url, {
    max: options?.max ?? 5,
    ssl: sslMode(),
    // Standaard dumpt postgres.js het hele notice-object in het log. Eén regel
    // is genoeg; de ivfflat-waarschuwing bij een verse migratie is verwacht.
    onnotice: (notice) => console.log(`[postgres] ${notice.message}`),
  });
  return { sql, db: drizzle(sql, { schema }) };
}

/**
 * 'prefer' probeert TLS en valt terug op plat als de server het niet aanbiedt.
 * Dat is precies wat je wilt: Railway's interne netwerk doet geen TLS, een
 * externe verbinding meestal wel. Met 'require' breekt de interne verbinding
 * af op "The server does not support SSL connections".
 *
 * Zet DATABASE_SSL als je het wilt afdwingen: require, verify-full, of disable.
 */
function sslMode(): 'require' | 'allow' | 'prefer' | 'verify-full' | boolean {
  const explicit = process.env.DATABASE_SSL?.trim();
  if (!explicit) return 'prefer';
  if (explicit === 'disable' || explicit === 'false') return false;
  return explicit as 'require' | 'allow' | 'prefer' | 'verify-full';
}

let cached: ReturnType<typeof createDb> | undefined;

/** Gedeelde verbinding per proces. Web en worker draaien apart, dus dit is veilig. */
export function getDb(): Database {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL ontbreekt');
    cached = createDb(url);
  }
  return cached.db;
}
