// De hele evaluatie in één commando: database inrichten, de opnames van de
// evaluatieset inladen, ze echt extraheren, en controleren of er niets
// verzonnen is.
//
//   pnpm eval [pad/naar/manifest.json]
//
// Recall en eigenaarsfouten blijven handwerk tegen docs/eval.md. Dat is expres:
// die sleutel is met de hand opgesteld en bevat oordelen, geen regels.
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, sources, eq, provision } from '@meetinghub/db';
import { extractSource } from '@meetinghub/core';
import { requireEnv } from './env.js';
import { checkQuotes } from './quotes.js';

interface Entry {
  externalId: string;
  title: string;
  occurredAt: string;
  durationSec?: number;
  summary: string;
  transcript: string;
  actionItems?: unknown;
}

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(
  process.argv[2] ?? resolve(here, '..', '..', '..', 'eval', 'manifest.json'),
);

requireEnv();

console.log(`evaluatie met ${manifestPath}\n`);
await provision(process.env.DATABASE_URL!);

const base = dirname(manifestPath);
const entries: Entry[] = JSON.parse(await readFile(manifestPath, 'utf8'));
const db = getDb();

let fabrications = 0;

for (const entry of entries) {
  const externalId = `fixture:${entry.externalId}`;
  const occurredAt = new Date(entry.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error(`datum niet leesbaar bij ${entry.externalId}: ${entry.occurredAt}`);
  }

  const values = {
    type: 'meeting' as const,
    externalId,
    title: entry.title,
    occurredAt,
    durationSec: entry.durationSec ?? null,
    rawText: await readFile(resolve(base, entry.transcript), 'utf8'),
    summaryText: await readFile(resolve(base, entry.summary), 'utf8'),
    providerActions: entry.actionItems ?? null,
  };

  const [inserted] = await db
    .insert(sources)
    .values(values)
    .onConflictDoNothing({ target: sources.externalId })
    .returning({ id: sources.id });

  const [row] = inserted
    ? [inserted]
    : await db.select({ id: sources.id }).from(sources).where(eq(sources.externalId, externalId));
  const sourceId = row!.id;

  console.log(`\n── ${entry.title}`);
  const started = Date.now();
  // force: ook herdraaien als deze bron al verwerkt is. Een evaluatie die zijn
  // eigen vorige uitkomst overslaat meet niets.
  let run;
  try {
    run = await extractSource(sourceId, { force: true });
  } catch (err) {
    console.error(`\nDe extractie is mislukt: ${err instanceof Error ? err.message : err}`);
    if (err instanceof Error && /authentication|api key|401/i.test(err.message)) {
      console.error('Dat ziet eruit als een probleem met ANTHROPIC_API_KEY.');
    }
    console.error('De call staat met promptversie, model en duur in de llm_calls tabel.');
    process.exit(1);
  }
  if (!run) throw new Error(`extractie leverde niets op voor ${sourceId}`);

  const r = run.result;
  console.log(
    `   ${Math.round((Date.now() - started) / 1000)}s · ` +
      `${r.besluiten.length} besluiten · ${r.toezeggingen.length} toezeggingen · ` +
      `${r.open_vragen.length} open vragen · ${r.risicos.length} risico's · ` +
      `${r.cijfers.length} cijfers · ${r.triage.length} triage · ${r.gevoelig.length} gevoelig`,
  );

  const check = await checkQuotes(sourceId);
  fabrications += check.fabricated;
  console.log(
    `   citaten: ${check.checked - check.fabricated}/${check.checked} letterlijk in de bron` +
      (check.fabricated ? `  ← ${check.fabricated} VERZONNEN` : ''),
  );
  for (const bad of check.problems) console.log(`     ${bad.path}: ${bad.fragment.slice(0, 90)}`);
  console.log(`   bekijk: /bronnen/${sourceId}`);
}

console.log(
  fabrications === 0
    ? '\nGeen verzinsels. De harde eis uit docs/eval.md is gehaald.'
    : `\n${fabrications} verzonnen citaten. De harde eis uit docs/eval.md is NIET gehaald.`,
);
console.log('Scoor recall en eigenaarsfouten met de hand tegen docs/eval.md,');
console.log('en leg de uitkomst vast in docs/eval-runs.md.');

process.exit(fabrications === 0 ? 0 : 1);
