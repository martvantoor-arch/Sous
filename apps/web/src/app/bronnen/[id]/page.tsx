// De ruwe bron naast de extractie. Dit is de pagina waarop je ziet of het
// systeem klopt: links wat er gezegd is, rechts wat het model eruit haalde.
import { notFound } from 'next/navigation';
import { getDb, sources, extractions, eq, desc } from '@meetinghub/db';
import { extractionSchema, type Extraction } from '@meetinghub/core';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BronPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const db = getDb();
  const [source] = await db.select().from(sources).where(eq(sources.id, id));
  if (!source) notFound();

  const [latest] = await db
    .select()
    .from(extractions)
    .where(eq(extractions.sourceId, id))
    .orderBy(desc(extractions.createdAt))
    .limit(1);

  // De opgeslagen JSON is bewust ruw. Valt hij buiten het schema, dan tonen we
  // dat in plaats van de pagina te laten crashen.
  const parsed = latest ? extractionSchema.safeParse(latest.result) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {source.title ?? 'Bron zonder titel'}
        </h1>
        <p className="text-sm text-stone-500">
          {source.type} · {source.occurredAt.toLocaleString('nl-NL')}
          {source.durationSec ? ` · ${Math.round(source.durationSec / 60)} minuten` : ''}
          {source.processedAt
            ? ` · verwerkt met ${source.promptVersion} op ${source.model}`
            : ' · nog niet verwerkt'}
        </p>
        {source.sensitive && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Gevoelig gemarkeerd: {source.sensitiveReason ?? 'reden niet vastgelegd'}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Ruwe bron
          </h2>
          <Panel title="Samenvatting">
            <Pre>{source.summaryText ?? '(geen samenvatting geleverd)'}</Pre>
          </Panel>
          <Panel title="Transcript">
            <Pre className="max-h-[32rem] overflow-y-auto">{source.rawText}</Pre>
          </Panel>
          {source.providerActions != null && (
            <Panel title="Actiepunten van Pocket (signaal, geen waarheid)">
              <Pre>{JSON.stringify(source.providerActions, null, 2)}</Pre>
            </Panel>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Extractie
          </h2>
          {!latest && <Panel title="Nog geen extractie">Deze bron staat nog in de wachtrij.</Panel>}
          {latest && parsed && !parsed.success && (
            <Panel title="Extractie voldoet niet aan het schema">
              <Pre>{parsed.error.message}</Pre>
            </Panel>
          )}
          {latest && parsed?.success && <ExtractionView result={parsed.data} />}
        </section>
      </div>
    </div>
  );
}

function ExtractionView({ result }: { result: Extraction }) {
  return (
    <>
      <Panel title="Project">
        {result.project.naam_raw || '(niet herkend)'}{' '}
        <Confidence value={result.project.confidence} />
      </Panel>

      <List
        title="Besluiten"
        items={result.besluiten}
        render={(d) => (
          <>
            <p>{d.wat}</p>
            {d.context && <Meta>{d.context}</Meta>}
            <Quote>{d.citaat}</Quote>
            <Confidence value={d.confidence} />
          </>
        )}
      />

      <List
        title="Toezeggingen"
        items={result.toezeggingen}
        render={(c) => (
          <>
            <p>{c.wat}</p>
            <Meta>
              eigenaar: {c.owner_raw || '(onbekend)'} · deadline:{' '}
              {c.deadline ?? (c.deadline_raw || 'niet genoemd')}
            </Meta>
            <Quote>{c.citaat}</Quote>
            <Confidence value={c.confidence} />
          </>
        )}
      />

      <List
        title="Afrondingen"
        items={result.afrondingen}
        render={(a) => (
          <>
            <p>{a.beschrijving_bestaand_punt}</p>
            <Meta>type: {a.type}</Meta>
            <Quote>{a.bewijs_citaat}</Quote>
            <Confidence value={a.confidence} />
          </>
        )}
      />

      <List
        title="Open vragen"
        items={result.open_vragen}
        render={(q) => (
          <>
            <p>{q.vraag}</p>
            <Quote>{q.citaat}</Quote>
            <Confidence value={q.confidence} />
          </>
        )}
      />

      <List
        title="Risico's"
        items={result.risicos}
        render={(r) => (
          <>
            <p>{r.omschrijving}</p>
            <Meta>ernst: {r.ernst ?? 'niet bepaald'}</Meta>
            <Quote>{r.citaat}</Quote>
          </>
        )}
      />

      <List
        title="Cijfers en data"
        items={result.cijfers}
        render={(m) => (
          <>
            <p>
              {m.naam}: {m.waarde ?? '—'} {m.eenheid} {m.datum ? `(${m.datum})` : ''}
            </p>
            <Quote>{m.citaat}</Quote>
          </>
        )}
      />

      <List
        title="Nieuwe termen"
        items={result.nieuwe_termen}
        render={(t) => (
          <>
            <p>{t.vermoedelijke_term}</p>
            <Meta>varianten: {t.varianten.join(', ') || '—'}</Meta>
            <Meta>{t.context}</Meta>
          </>
        )}
      />

      <List
        title="Gevoelig, niet geëxtraheerd"
        items={result.gevoelig}
        render={(g) => (
          <>
            <p>{g.onderwerp}</p>
            <Meta>{g.reden}</Meta>
          </>
        )}
      />

      <List
        title="Triage"
        items={result.triage}
        render={(t) => (
          <>
            <p>{t.vraag}</p>
            <Meta>soort: {t.kind}</Meta>
            <Confidence value={t.confidence} />
          </>
        )}
      />
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function List<T>({
  title,
  items,
  render,
}: {
  title: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  return (
    <Panel title={`${title} (${items.length})`}>
      {items.length === 0 ? (
        <p className="text-stone-500">Niets gevonden.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="border-l-2 border-stone-200 pl-3 dark:border-stone-700">
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-stone-500">{children}</p>;
}

function Quote({ children }: { children: string }) {
  if (!children) return null;
  return <p className="mt-1 text-xs italic text-stone-600 dark:text-stone-400">“{children}”</p>;
}

function Confidence({ value }: { value: number }) {
  const low = value < 0.75;
  return (
    <span
      className={
        'mt-1 inline-block rounded px-1.5 py-0.5 text-xs ' +
        (low
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
          : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300')
      }
    >
      zekerheid {value.toFixed(2)}
    </span>
  );
}

function Pre({ children, className = '' }: { children: string; className?: string }) {
  return (
    <pre className={`whitespace-pre-wrap break-words font-sans text-sm ${className}`}>
      {children}
    </pre>
  );
}
