import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDb>['db'];

export function createDb(url: string, options?: { max?: number }) {
  const sql = postgres(url, {
    max: options?.max ?? 5,
    // Railway Postgres praat TLS zonder publiek vertrouwde keten.
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
  });
  return { sql, db: drizzle(sql, { schema }) };
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
