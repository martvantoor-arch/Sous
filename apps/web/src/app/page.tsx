// Bewust geen dashboard: alleen de bronnenlijst, zodat je bij /bronnen/[id]
// kunt komen. Statussen wijzig je hier niet, dat is expres.
import Link from 'next/link';
import { getDb, sources, desc } from '@meetinghub/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const db = getDb();
  const rows = await db
    .select({
      id: sources.id,
      title: sources.title,
      type: sources.type,
      occurredAt: sources.occurredAt,
      processedAt: sources.processedAt,
      sensitive: sources.sensitive,
    })
    .from(sources)
    .orderBy(desc(sources.occurredAt))
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Bronnen</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nog geen bronnen ontvangen. Stuur een Pocket-opname naar{' '}
          <code>POST /api/ingest/pocket</code>.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
          {rows.map((s) => (
            <li key={s.id}>
              <Link href={`/bronnen/${s.id}`} className="block px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800">
                <span className="font-medium">{s.title ?? 'Bron zonder titel'}</span>
                <span className="ml-2 text-xs text-stone-500">
                  {s.type} · {s.occurredAt.toLocaleDateString('nl-NL')} ·{' '}
                  {s.processedAt ? 'verwerkt' : 'in wachtrij'}
                  {s.sensitive ? ' · gevoelig' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
