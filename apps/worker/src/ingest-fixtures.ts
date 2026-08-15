// Zet de opnames van de evaluatieset in de database en in de wachtrij, zodat de
// worker ze via de gewone weg extraheert. Zelfde insert als de webhook, maar
// zonder handtekening en publieke URL, want dit is een onderhoudscommando.
//
//   node dist/ingest-fixtures.js eval/manifest.json
//
// De paden in het manifest zijn relatief aan het manifest zelf.
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { getDb, sources, eq } from '@meetinghub/db';
import { enqueueExtraction } from '@meetinghub/core';

interface Entry {
  externalId: string;
  title: string;
  /** ISO 8601, bijvoorbeeld 2026-08-12T13:00:00Z */
  occurredAt: string;
  durationSec?: number;
  /** Pad naar het bestand met de Pocket samenvatting. */
  summary: string;
  /** Pad naar het bestand met het transcript. */
  transcript: string;
  /** De actiepunten van Pocket, letterlijk overgenomen. Signaal, geen waarheid. */
  actionItems?: unknown;
}

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('gebruik: ingest-fixtures <manifest.json>');
  process.exit(1);
}

const base = dirname(resolve(manifestPath));
const entries: Entry[] = JSON.parse(await readFile(manifestPath, 'utf8'));
const db = getDb();

for (const entry of entries) {
  const externalId = `fixture:${entry.externalId}`;
  const occurredAt = new Date(entry.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error(`datum niet leesbaar bij ${entry.externalId}: ${entry.occurredAt}`);
  }

  const [inserted] = await db
    .insert(sources)
    .values({
      type: 'meeting',
      externalId,
      title: entry.title,
      occurredAt,
      durationSec: entry.durationSec ?? null,
      rawText: await readFile(resolve(base, entry.transcript), 'utf8'),
      summaryText: await readFile(resolve(base, entry.summary), 'utf8'),
      providerActions: entry.actionItems ?? null,
    })
    .onConflictDoNothing({ target: sources.externalId })
    .returning({ id: sources.id });

  if (!inserted) {
    const [known] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.externalId, externalId));
    console.log(`${entry.title}: stond er al als ${known?.id}, niet opnieuw in de wachtrij`);
    continue;
  }

  await enqueueExtraction({ sourceId: inserted.id });
  console.log(`${entry.title}: ${inserted.id}, in de wachtrij`);
}

process.exit(0);
