// Het vaktermenwoordenboek. Dit is geen naslagwerk maar een werkend onderdeel
// van de extractie: deze lijst gaat bij elke call mee in de prompt. Zonder
// "bij elkaar" hier leest het model BLK als gewone taal en gaat de hele meeting
// verkeerd.
import Link from 'next/link';
import { getDb, terms, asc } from '@meetinghub/db';

export const dynamic = 'force-dynamic';

export default async function TermenPagina() {
  const rijen = await getDb().select().from(terms).orderBy(asc(terms.term));

  const perDomein = new Map<string, typeof rijen>();
  for (const t of rijen) {
    const d = t.domain ?? 'overig';
    perDomein.set(d, [...(perDomein.get(d) ?? []), t]);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Vaktermen</h1>
        <p className="text-sm text-stone-500">
          {rijen.length} termen, met de verhaspelingen die de spraakherkenning ervan maakt. Deze
          lijst gaat bij elke extractie mee in de prompt. Nieuwe termen komen langs via de{' '}
          <Link href="/triage" className="underline">triage wachtrij</Link>.
        </p>
      </header>

      {rijen.length === 0 ? (
        <p className="text-sm text-stone-500">Nog geen termen.</p>
      ) : (
        [...perDomein.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([domein, lijst]) => (
            <section key={domein} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {domein}
              </h2>
              <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
                {lijst.map((t) => (
                  <li key={t.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{t.term}</span>
                      {t.expansion && (
                        <span className="text-sm text-stone-600 dark:text-stone-400">
                          {t.expansion}
                        </span>
                      )}
                    </div>
                    {t.variants.length > 0 && (
                      <p className="mt-1 text-xs text-stone-500">
                        verhaspeld als {t.variants.map((v) => `"${v}"`).join(', ')}
                      </p>
                    )}
                    {t.note && <p className="mt-1 text-xs text-stone-500">{t.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
