// Het organogram: de `manager_id` kolom uitgelezen als boom, per organisatie.
//
// Foodconnect en de externe partijen staan los van elkaar, want het zijn geen
// één organisatie — Bibi is Category Manager bij Albert Heijn en dus de klant,
// geen collega. Ze in één boom zetten zou precies de verwarring maken die
// `CLAUDE.md` wil voorkomen.
//
// Wie geen manager heeft staat bovenaan zijn eigen organisatie. Dat is geen
// bewering dat diegene de baas is; het betekent alleen dat het nog niet is
// ingevuld.
import Link from 'next/link';
import { getDb, people, asc } from '@meetinghub/db';

export const dynamic = 'force-dynamic';

type Persoon = typeof people.$inferSelect;

export default async function OrganogramPagina() {
  const rijen = await getDb().select().from(people).orderBy(asc(people.name));

  const perOrganisatie = new Map<string, Persoon[]>();
  for (const p of rijen) {
    const org = p.organisation?.trim() || (p.isInternal ? 'Foodconnect' : 'Zonder organisatie');
    perOrganisatie.set(org, [...(perOrganisatie.get(org) ?? []), p]);
  }

  // Foodconnect eerst, daarna de rest op alfabet: het eigen huis bovenaan.
  const organisaties = [...perOrganisatie.entries()].sort(([a], [b]) => {
    if (a === 'Foodconnect') return -1;
    if (b === 'Foodconnect') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Organogram</h1>
          <Link href="/personen" className="text-sm underline">
            Personen beheren
          </Link>
        </div>
        <p className="text-sm text-stone-500">
          Wie aan wie rapporteert, per organisatie. Vul &ldquo;rapporteert aan&rdquo; in bij een
          persoon om de boom te laten groeien.
        </p>
      </header>

      {rijen.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nog geen personen. Voeg ze toe bij{' '}
          <Link href="/personen" className="underline">personen</Link>.
        </p>
      ) : (
        organisaties.map(([org, leden]) => (
          <section key={org} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {org}
              <span className="ml-2 font-normal normal-case text-stone-400">
                {leden.length} {leden.length === 1 ? 'persoon' : 'personen'}
              </span>
            </h2>
            <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
              <Boom leden={leden} alleLeden={rijen} />
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/**
 * Tekent de boom binnen één organisatie.
 *
 * Een manager die in een ándere organisatie zit telt hier als "geen manager",
 * anders zou iemand uit zijn eigen tak verdwijnen. Zo blijft iedereen zichtbaar
 * in precies één boom.
 */
function Boom({ leden, alleLeden }: { leden: Persoon[]; alleLeden: Persoon[] }) {
  const inGroep = new Set(leden.map((p) => p.id));

  const wortels = leden.filter((p) => !p.managerId || !inGroep.has(p.managerId));
  const kinderenVan = (id: string) => leden.filter((p) => p.managerId === id);

  const externeManager = (p: Persoon) =>
    p.managerId && !inGroep.has(p.managerId)
      ? alleLeden.find((m) => m.id === p.managerId)?.name
      : undefined;

  return (
    <ul className="space-y-1">
      {wortels.map((p) => (
        <Tak
          key={p.id}
          persoon={p}
          kinderenVan={kinderenVan}
          externeManager={externeManager}
          diepte={0}
        />
      ))}
    </ul>
  );
}

function Tak({
  persoon,
  kinderenVan,
  externeManager,
  diepte,
}: {
  persoon: Persoon;
  kinderenVan: (id: string) => Persoon[];
  externeManager: (p: Persoon) => string | undefined;
  diepte: number;
}) {
  const kinderen = kinderenVan(persoon.id);
  const elders = externeManager(persoon);

  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-2 py-1">
        <span className={`font-medium ${persoon.active ? '' : 'text-stone-400 line-through'}`}>
          {persoon.name}
        </span>
        {persoon.role && (
          <span className="text-xs text-stone-500">{persoon.role}</span>
        )}
        {elders && <span className="text-xs text-stone-400">· rapporteert aan {elders}</span>}
        {!persoon.active && <span className="text-xs text-stone-400">· inactief</span>}
        {diepte === 0 && kinderen.length === 0 && (
          <span className="text-xs text-stone-400">· nog niet ingedeeld</span>
        )}
      </div>

      {kinderen.length > 0 && (
        <ul className="ml-3 space-y-1 border-l border-stone-200 pl-4 dark:border-stone-700">
          {kinderen.map((k) => (
            <Tak
              key={k.id}
              persoon={k}
              kinderenVan={kinderenVan}
              externeManager={externeManager}
              diepte={diepte + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
