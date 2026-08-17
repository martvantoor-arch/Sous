// De opvolgingsweergave: alle toezeggingen, gegroepeerd naar wat ze van je
// vragen.
//
// De volgorde is het hele punt. **Stil** staat bovenaan, want dat is de
// categorie die het systeem bestaat om zichtbaar te maken — kernprincipe 4: een
// toezegging die niet meer genoemd wordt is niet afgerond, die is stil. Zonder
// deze lijst verdwijnt zo'n punt geruisloos, en dat is precies het gat dat een
// projectgeheugen hoort te dichten.
//
// Er zitten geen knoppen bij om een status te wijzigen. Dat is expres: een
// status volgt uit de bronnen en uit de stilteregel, niet uit een klik.
import Link from 'next/link';
import {
  getDb,
  commitments,
  people,
  projects,
  sources,
  eq,
  desc,
  asc,
} from '@meetinghub/db';

export const dynamic = 'force-dynamic';

/** Bovenaan wat aandacht vraagt, onderaan wat klaar is. */
const GROEPEN = [
  {
    status: 'stil',
    titel: 'Stil geworden',
    uitleg:
      'Al een tijd niet meer genoemd, en niet afgerond. Dit is geen status maar een signaal: vraag ernaar.',
  },
  {
    status: 'open',
    titel: 'Open',
    uitleg: 'Toegezegd en nog niet afgerond.',
  },
  {
    status: 'bijgewerkt',
    titel: 'Bijgewerkt',
    uitleg: 'Kwam in een latere bron terug met een wijziging: andere deadline, andere eigenaar.',
  },
  {
    status: 'afgerond',
    titel: 'Afgerond',
    uitleg: 'Met bewijs uit een bron afgesloten.',
  },
  {
    status: 'vervallen',
    titel: 'Vervallen',
    uitleg: 'Gaat niet door.',
  },
] as const;

export default async function OpvolgingPagina() {
  const db = getDb();

  const rijen = await db
    .select({
      id: commitments.id,
      wat: commitments.what,
      status: commitments.status,
      statusBron: commitments.statusSource,
      ownerRaw: commitments.ownerRaw,
      eigenaar: people.name,
      project: projects.name,
      deadline: commitments.deadline,
      deadlineRaw: commitments.deadlineRaw,
      laatstGezien: commitments.lastSeenAt,
      afgeslotenCitaat: commitments.closedQuote,
      bronId: commitments.lastSeenSource,
      bronTitel: sources.title,
    })
    .from(commitments)
    .leftJoin(people, eq(commitments.ownerId, people.id))
    .leftJoin(projects, eq(commitments.projectId, projects.id))
    .leftJoin(sources, eq(commitments.lastSeenSource, sources.id))
    .orderBy(asc(commitments.deadline), desc(commitments.lastSeenAt));

  const perStatus = new Map<string, typeof rijen>();
  for (const r of rijen) perStatus.set(r.status, [...(perStatus.get(r.status) ?? []), r]);

  const stil = perStatus.get('stil')?.length ?? 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Opvolging</h1>
        <p className="text-sm text-stone-500">
          {rijen.length === 0
            ? 'Nog geen toezeggingen. Die komen uit de meetings.'
            : `${rijen.length} ${rijen.length === 1 ? 'toezegging' : 'toezeggingen'}` +
              (stil ? `, waarvan ${stil} stil geworden.` : '.')}
        </p>
      </header>

      {GROEPEN.map((groep) => {
        const lijst = perStatus.get(groep.status) ?? [];
        if (lijst.length === 0) return null;

        const opvallend = groep.status === 'stil';

        return (
          <section key={groep.status} className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold">
                {groep.titel}
                <span className="ml-2 font-normal text-stone-400">{lijst.length}</span>
              </h2>
              <p className="text-xs text-stone-500">{groep.uitleg}</p>
            </div>

            <ul
              className={`divide-y rounded-lg border bg-white dark:bg-stone-900 ${
                opvallend
                  ? 'divide-amber-200 border-amber-300 dark:divide-amber-900 dark:border-amber-800'
                  : 'divide-stone-200 border-stone-200 dark:divide-stone-800 dark:border-stone-800'
              }`}
            >
              {lijst.map((t) => (
                <li key={t.id} className="px-4 py-3">
                  <p className="text-sm font-medium">{t.wat}</p>

                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-stone-500">
                    <span>{t.eigenaar ?? t.ownerRaw ?? 'eigenaar onbekend'}</span>
                    {t.project && <span>· {t.project}</span>}
                    {(t.deadline || t.deadlineRaw) && (
                      <span>· uiterlijk {t.deadline ?? t.deadlineRaw}</span>
                    )}
                    {t.laatstGezien && (
                      <span>· laatst genoemd {t.laatstGezien.toLocaleDateString('nl-NL')}</span>
                    )}
                    {t.statusBron === 'regel' && <span>· door de stilteregel</span>}
                    {t.bronId && (
                      <Link href={`/bronnen/${t.bronId}`} className="underline">
                        {t.bronTitel ?? 'bron'}
                      </Link>
                    )}
                  </div>

                  {t.afgeslotenCitaat && (
                    <p className="mt-1 border-l-2 border-stone-200 pl-2 text-xs italic text-stone-500 dark:border-stone-700">
                      {t.afgeslotenCitaat}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
