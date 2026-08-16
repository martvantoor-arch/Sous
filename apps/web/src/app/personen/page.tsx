// Personen met hun verhaspelingen. De aliassen zijn geen curiositeit: ze gaan
// bij elke extractie mee in de prompt, en zonder "de Tina" erbij wordt Bettina
// niet herkend.
import Link from 'next/link';
import { getDb, people, asc } from '@meetinghub/db';

export const dynamic = 'force-dynamic';

export default async function PersonenPagina() {
  const rijen = await getDb().select().from(people).orderBy(asc(people.name));

  const intern = rijen.filter((p) => p.isInternal);
  const extern = rijen.filter((p) => !p.isInternal);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Personen</h1>
        <p className="text-sm text-stone-500">
          Nieuwe personen komen binnen als voorstel in de{' '}
          <Link href="/triage" className="underline">triage wachtrij</Link>. Het systeem maakt er
          nooit zelf een aan.
        </p>
      </header>

      {rijen.length === 0 ? (
        <p className="text-sm text-stone-500">Nog geen personen.</p>
      ) : (
        <div className="space-y-6">
          <Groep titel="Foodconnect" rijen={intern} />
          <Groep titel="Extern" rijen={extern} />
        </div>
      )}
    </div>
  );
}

function Groep({
  titel,
  rijen,
}: {
  titel: string;
  rijen: (typeof people.$inferSelect)[];
}) {
  if (rijen.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{titel}</h2>
      <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
        {rijen.map((p) => (
          <li key={p.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">{p.name}</span>
              {p.role && <span className="text-xs text-stone-500">{p.role}</span>}
              {p.organisation && <span className="text-xs text-stone-500">· {p.organisation}</span>}
              {!p.active && <span className="text-xs text-stone-400">· inactief</span>}
            </div>
            {p.aliases.length > 0 && (
              <p className="mt-1 text-xs text-stone-500">
                ook gehoord als {p.aliases.map((a) => `"${a}"`).join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
