// Projecten met wat eruit gekomen is. Geen statussen om te wijzigen — die
// volgen uit de bronnen, niet uit een knop.
import Link from 'next/link';
import {
  getDb,
  projects,
  sourceProjects,
  decisions,
  commitments,
  openQuestions,
  risks,
  people,
  eq,
  sql,
  asc,
} from '@meetinghub/db';

export const dynamic = 'force-dynamic';

/** Telt per project hoeveel er van één soort punt aan hangt. */
function tellingen(tabel: typeof decisions | typeof commitments | typeof openQuestions | typeof risks) {
  return getDb()
    .select({ projectId: tabel.projectId, n: sql<number>`count(*)::int` })
    .from(tabel)
    .groupBy(tabel.projectId);
}

export default async function ProjectenPagina() {
  const db = getDb();

  const [rijen, besluiten, toezeggingen, vragen, risicos, bronnen] = await Promise.all([
    db
      .select({
        id: projects.id,
        naam: projects.name,
        code: projects.code,
        status: projects.status,
        omschrijving: projects.description,
        eigenaar: people.name,
      })
      .from(projects)
      .leftJoin(people, eq(projects.ownerId, people.id))
      .orderBy(asc(projects.name)),
    tellingen(decisions),
    tellingen(commitments),
    tellingen(openQuestions),
    tellingen(risks),
    db
      .select({ projectId: sourceProjects.projectId, n: sql<number>`count(*)::int` })
      .from(sourceProjects)
      .groupBy(sourceProjects.projectId),
  ]);

  const index = (rows: { projectId: string | null; n: number }[]) =>
    new Map(rows.filter((r) => r.projectId).map((r) => [r.projectId!, Number(r.n)]));

  const b = index(besluiten);
  const t = index(toezeggingen);
  const v = index(vragen);
  const r = index(risicos);
  const s = index(bronnen);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Projecten</h1>
        <p className="text-sm text-stone-500">
          Een meeting raakt vaak meer dan één project. De aantallen hieronder tellen de punten
          die aan dat project zijn toegewezen, niet de meetings waarin ze vielen.
        </p>
      </header>

      {rijen.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nog geen projecten. Ze komen uit de seed of via de{' '}
          <Link href="/triage" className="underline">triage wachtrij</Link>.
        </p>
      ) : (
        <ul className="space-y-3">
          {rijen.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-medium">{p.naam}</h2>
                {p.code && <code className="text-xs text-stone-500">{p.code}</code>}
                <span className="text-xs text-stone-500">{p.status}</span>
                {p.eigenaar && <span className="text-xs text-stone-500">· {p.eigenaar}</span>}
              </div>
              {p.omschrijving && (
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{p.omschrijving}</p>
              )}
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-500">
                <Telling label="bronnen" n={s.get(p.id)} />
                <Telling label="besluiten" n={b.get(p.id)} />
                <Telling label="toezeggingen" n={t.get(p.id)} />
                <Telling label="open vragen" n={v.get(p.id)} />
                <Telling label="risico's" n={r.get(p.id)} />
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Telling({ label, n }: { label: string; n: number | undefined }) {
  return (
    <span className={n ? '' : 'opacity-50'}>
      <span className="font-medium text-stone-700 dark:text-stone-300">{n ?? 0}</span> {label}
    </span>
  );
}
