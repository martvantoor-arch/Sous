// Personen beheren. Nieuwe mensen komen meestal als voorstel uit een meeting
// binnen via de triage wachtrij, maar je moet er ook zonder meeting bij kunnen:
// iemand toevoegen, een verhaspelde naam corrigeren, of iemand die weg is op
// inactief zetten.
//
// Verwijderen kan alleen zolang er niets aan hangt. Iemand met toezeggingen op
// zijn naam wegpoetsen zou het geheugen stukmaken; daarvoor is inactief.
import Link from 'next/link';
import { getDb, people, asc } from '@meetinghub/db';
import { tellVerwijzingenNaarPersoon } from '@meetinghub/core';
import { PersoonVelden } from './PersoonFormulier';
import { voegPersoonToe, bewerkPersoon, wisselActief, schrapPersoon } from './actions';

export const dynamic = 'force-dynamic';

export default async function PersonenPagina({
  searchParams,
}: {
  searchParams: Promise<{ melding?: string; bewerk?: string }>;
}) {
  const { melding, bewerk } = await searchParams;
  const db = getDb();
  const rijen = await db.select().from(people).orderBy(asc(people.name));

  // Wie is veilig te verwijderen? Dat bepaalt of we die knop tonen, in plaats
  // van hem te tonen en pas na de klik te zeggen dat het niet kan.
  const verwijzingen = new Map<string, number>(
    await Promise.all(
      rijen.map(async (p) => [p.id, await tellVerwijzingenNaarPersoon(p.id)] as const),
    ),
  );

  const namen = rijen.map((p) => ({ id: p.id, name: p.name, role: p.role }));
  const intern = rijen.filter((p) => p.isInternal);
  const extern = rijen.filter((p) => !p.isInternal);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Personen</h1>
          <Link href="/organogram" className="text-sm underline">
            Organogram
          </Link>
        </div>
        <p className="text-sm text-stone-500">
          Voorstellen uit meetings komen binnen via de{' '}
          <Link href="/triage" className="underline">triage wachtrij</Link>. Hier voeg je zelf toe
          en corrigeer je wat er staat.
        </p>
      </header>

      {melding && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {melding}
        </p>
      )}

      <details className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <summary className="cursor-pointer text-sm font-medium">Persoon toevoegen</summary>
        <form action={voegPersoonToe} className="mt-4 space-y-3">
          <PersoonVelden mogelijkeManagers={namen} />
          <button
            type="submit"
            className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            Toevoegen
          </button>
        </form>
      </details>

      {rijen.length === 0 ? (
        <p className="text-sm text-stone-500">Nog geen personen.</p>
      ) : (
        <div className="space-y-6">
          <Groep
            titel="Foodconnect"
            rijen={intern}
            namen={namen}
            verwijzingen={verwijzingen}
            bewerkId={bewerk}
          />
          <Groep
            titel="Extern"
            rijen={extern}
            namen={namen}
            verwijzingen={verwijzingen}
            bewerkId={bewerk}
          />
        </div>
      )}
    </div>
  );
}

function Groep({
  titel,
  rijen,
  namen,
  verwijzingen,
  bewerkId,
}: {
  titel: string;
  rijen: (typeof people.$inferSelect)[];
  namen: { id: string; name: string; role: string | null }[];
  verwijzingen: Map<string, number>;
  bewerkId?: string;
}) {
  if (rijen.length === 0) return null;
  const naam = (id: string | null) => namen.find((n) => n.id === id)?.name;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{titel}</h2>
      <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
        {rijen.map((p) => {
          const hangtAan = verwijzingen.get(p.id) ?? 0;
          const inBewerking = bewerkId === p.id;

          return (
            <li key={p.id} className="px-4 py-3">
              {inBewerking ? (
                <form action={bewerkPersoon} className="space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <PersoonVelden persoon={p} mogelijkeManagers={namen} />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                    >
                      Opslaan
                    </button>
                    <Link
                      href="/personen"
                      className="rounded px-3 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                    >
                      Annuleren
                    </Link>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={`font-medium ${p.active ? '' : 'text-stone-400 line-through'}`}>
                      {p.name}
                    </span>
                    {p.role && <span className="text-xs text-stone-500">{p.role}</span>}
                    {p.organisation && (
                      <span className="text-xs text-stone-500">· {p.organisation}</span>
                    )}
                    {p.managerId && (
                      <span className="text-xs text-stone-500">
                        · rapporteert aan {naam(p.managerId) ?? 'onbekend'}
                      </span>
                    )}
                    {p.email && (
                      // Zichtbaar omdat het adres bepaalt of een doorgestuurde
                      // mail aan deze persoon gehangen wordt. Staat het er niet
                      // of staat het fout, dan blijft de afzender onbekend.
                      <span className="text-xs text-stone-500">· {p.email}</span>
                    )}
                    {!p.active && <span className="text-xs text-stone-400">· inactief</span>}
                  </div>

                  {p.aliases.length > 0 && (
                    <p className="mt-1 text-xs text-stone-500">
                      ook gehoord als {p.aliases.map((a) => `"${a}"`).join(', ')}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={`/personen?bewerk=${p.id}`}
                      className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                    >
                      Wijzigen
                    </Link>

                    <form action={wisselActief}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="actief" value={p.active ? 'nee' : 'ja'} />
                      <button
                        type="submit"
                        className="rounded px-2 py-0.5 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                      >
                        {p.active ? 'Op inactief zetten' : 'Weer activeren'}
                      </button>
                    </form>

                    {hangtAan === 0 ? (
                      <form action={schrapPersoon}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="rounded px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Verwijderen
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-stone-400">
                        hangt aan {hangtAan} {hangtAan === 1 ? 'punt' : 'punten'}, niet te
                        verwijderen
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
