// De triage wachtrij. Geen backlog maar de agenda van het ochtendgesprek:
// wat het systeem niet zeker wist, in volgorde van wat het meest oplevert.
//
// Voorstellen voor iets nieuws staan bovenaan, want daar hangt de rest aan —
// zolang een persoon niet bestaat blijven toezeggingen zonder eigenaar staan,
// en zolang een vakterm ontbreekt gaat elke volgende meeting hem weer
// verhaspelen.
import Link from 'next/link';
import { getDb, triageQueue, sources, eq, and, desc, asc } from '@meetinghub/db';
import { beslisOverTriage } from './actions';

export const dynamic = 'force-dynamic';

/** Wat er aangemaakt kan worden staat voorop; vragen over bestaande punten erna. */
const VOLGORDE: Record<string, number> = {
  persoon_onbekend: 0,
  nieuwe_persoon: 0,
  project_onbekend: 1,
  project: 1,
  nieuwe_term: 2,
};

const LABEL: Record<string, string> = {
  persoon_onbekend: 'Nieuwe persoon',
  nieuwe_persoon: 'Nieuwe persoon',
  project_onbekend: 'Nieuw project',
  project: 'Project onduidelijk',
  nieuwe_term: 'Nieuwe vakterm',
  toezegging: 'Toezegging',
  besluit: 'Besluit',
  open_vraag: 'Open vraag',
  risico: 'Risico',
  afronding: 'Afronding',
  conflict: 'Tegenstrijdigheid',
};

export default async function TriagePagina({
  searchParams,
}: {
  searchParams: Promise<{ melding?: string }>;
}) {
  const { melding } = await searchParams;
  const db = getDb();

  const items = await db
    .select({
      id: triageQueue.id,
      kind: triageQueue.kind,
      vraag: triageQueue.question,
      voorstel: triageQueue.proposal,
      confidence: triageQueue.confidence,
      aangemaaktOp: triageQueue.createdAt,
      bronId: sources.id,
      bronTitel: sources.title,
      bronDatum: sources.occurredAt,
    })
    .from(triageQueue)
    .leftJoin(sources, eq(triageQueue.sourceId, sources.id))
    .where(eq(triageQueue.status, 'open'))
    .orderBy(desc(triageQueue.createdAt));

  const gesorteerd = [...items].sort(
    (a, b) => (VOLGORDE[a.kind] ?? 9) - (VOLGORDE[b.kind] ?? 9),
  );

  const [afgehandeld] = await db
    .select({ n: triageQueue.id })
    .from(triageQueue)
    .where(and(eq(triageQueue.status, 'akkoord')))
    .orderBy(asc(triageQueue.createdAt))
    .limit(1);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Triage</h1>
        <p className="text-sm text-stone-500">
          {gesorteerd.length === 0
            ? 'Niets open. Alles wat het systeem tegenkwam was duidelijk genoeg.'
            : `${gesorteerd.length} ${gesorteerd.length === 1 ? 'punt' : 'punten'} waar het systeem niet uit kwam.`}
        </p>
      </header>

      {melding && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {melding}
        </p>
      )}

      {gesorteerd.length === 0 && afgehandeld && (
        <p className="text-sm text-stone-500">
          Eerder goedgekeurde voorstellen staan bij{' '}
          <Link href="/personen" className="underline">personen</Link>,{' '}
          <Link href="/projecten" className="underline">projecten</Link> en{' '}
          <Link href="/termen" className="underline">termen</Link>.
        </p>
      )}

      <ul className="space-y-3">
        {gesorteerd.map((item) => {
          const kanAanmaken = (VOLGORDE[item.kind] ?? 9) < 9;
          const voorstel = (item.voorstel ?? null) as Record<string, unknown> | null;
          return (
            <li
              key={item.id}
              className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                  {LABEL[item.kind] ?? item.kind}
                </span>
                {item.confidence != null && (
                  <span className="text-xs text-stone-500">zekerheid {item.confidence}</span>
                )}
                {item.bronId && (
                  <Link
                    href={`/bronnen/${item.bronId}`}
                    className="text-xs text-stone-500 underline hover:text-stone-800 dark:hover:text-stone-200"
                  >
                    {item.bronTitel ?? 'bron'}
                    {item.bronDatum ? ` · ${item.bronDatum.toLocaleDateString('nl-NL')}` : ''}
                  </Link>
                )}
              </div>

              <p className="mt-2 text-sm">{item.vraag}</p>

              <form action={beslisOverTriage} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={item.id} />

                {kanAanmaken ? (
                  <VoorstelVelden kind={item.kind} voorstel={voorstel} />
                ) : (
                  voorstel && (
                    <pre className="overflow-x-auto rounded bg-stone-50 p-2 text-xs text-stone-600 dark:bg-stone-950 dark:text-stone-400">
                      {JSON.stringify(voorstel, null, 2)}
                    </pre>
                  )
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="besluit"
                    value="akkoord"
                    className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                  >
                    {kanAanmaken ? 'Aanmaken' : 'Beantwoord'}
                  </button>
                  <button
                    type="submit"
                    name="besluit"
                    value="afgewezen"
                    className="rounded px-3 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    Afwijzen
                  </button>
                </div>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Het voorstel als invulbare velden in plaats van als JSON-blok.
 *
 * Het model raadt de naam uit een transcript waarin sprekers niet gelabeld zijn
 * en de spraakherkenning namen structureel verhaspelt — "patina" voor Bettina.
 * Zo'n naam moet je kunnen corrigeren vóór hij het geheugen in gaat, want daarna
 * hangt hij aan elke toezegging en gaat hij mee in elke volgende prompt.
 */
function VoorstelVelden({
  kind,
  voorstel,
}: {
  kind: string;
  voorstel: Record<string, unknown> | null;
}) {
  const tekst = (sleutel: string) => {
    const v = voorstel?.[sleutel];
    return typeof v === 'string' ? v : '';
  };
  const lijst = (sleutel: string) => {
    const v = voorstel?.[sleutel];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(', ') : '';
  };

  if (kind === 'nieuwe_term') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Invoer label="Term" naam="vermoedelijke_term" waarde={tekst('vermoedelijke_term')} />
        <Invoer label="Betekenis" naam="betekenis" waarde={tekst('betekenis')} />
        <Invoer
          label="Verhaspelingen, gescheiden door komma's"
          naam="varianten"
          waarde={lijst('varianten')}
          breed
        />
        {voorstel?.context ? (
          <p className="text-xs text-stone-500 sm:col-span-2">{String(voorstel.context)}</p>
        ) : null}
      </div>
    );
  }

  if (kind === 'project_onbekend' || kind === 'project') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Invoer label="Projectnaam" naam="naam" waarde={tekst('naam') || tekst('naam_raw')} />
        <Invoer label="Aliassen" naam="varianten" waarde={lijst('varianten')} />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Invoer label="Naam" naam="naam" waarde={tekst('naam')} />
      <Invoer label="Rol" naam="rol" waarde={tekst('rol')} />
      <Invoer label="Organisatie" naam="organisatie" waarde={tekst('organisatie')} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-stone-600 dark:text-stone-400">Hoort bij</span>
        <select
          name="isIntern"
          defaultValue={voorstel?.is_intern === false ? 'nee' : 'ja'}
          className="rounded border border-stone-300 bg-white px-2 py-1 dark:border-stone-700 dark:bg-stone-950"
        >
          <option value="ja">Foodconnect</option>
          <option value="nee">Extern</option>
        </select>
      </label>
      <Invoer
        label="Aliassen en verhaspelingen, gescheiden door komma's"
        naam="varianten"
        waarde={lijst('varianten')}
        breed
      />
      {voorstel?.context ? (
        <p className="text-xs text-stone-500 sm:col-span-2">{String(voorstel.context)}</p>
      ) : null}
    </div>
  );
}

function Invoer({
  label,
  naam,
  waarde,
  breed,
}: {
  label: string;
  naam: string;
  waarde: string;
  breed?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${breed ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium text-stone-600 dark:text-stone-400">{label}</span>
      <input
        name={naam}
        defaultValue={waarde}
        className="rounded border border-stone-300 bg-white px-2 py-1 dark:border-stone-700 dark:bg-stone-950"
      />
    </label>
  );
}
