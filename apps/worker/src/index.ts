// Verwerkingsservice. Draait los van de web service zodat een lange extractie
// nooit een webhook laat aflopen.
import { EXTRACT_QUEUE, extractSource, getBoss, stopBoss, type ExtractJob } from '@meetinghub/core';
import { provision } from '@meetinghub/db';
import { requireEnv } from './env.js';

requireEnv();

// Een verse deploy richt zichzelf in. Migraties zijn idempotent en staan onder
// een advisory lock; de seed draait alleen op een lege database. Zet
// SKIP_PROVISION=1 als je de migraties met de hand wilt sturen.
if (process.env.SKIP_PROVISION !== '1') {
  await provision(process.env.DATABASE_URL!);
}

const boss = await getBoss();

await boss.work<ExtractJob>(EXTRACT_QUEUE, { batchSize: 1 }, async ([job]) => {
  if (!job) return;
  const { sourceId, force } = job.data;
  const started = Date.now();
  console.log(`[extractie] start ${sourceId}`);

  const run = await extractSource(sourceId, { force });
  if (!run) {
    console.log(`[extractie] ${sourceId} was al verwerkt, overgeslagen`);
    return;
  }

  const r = run.result;
  console.log(
    `[extractie] klaar ${sourceId} in ${Date.now() - started}ms — ` +
      `${r.besluiten.length} besluiten, ${r.toezeggingen.length} toezeggingen, ` +
      `${r.open_vragen.length} open vragen, ${r.risicos.length} risico's, ` +
      `${r.triage.length} triage, ${r.gevoelig.length} gevoelig`,
  );
});

console.log(`worker luistert op ${EXTRACT_QUEUE}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`${signal} ontvangen, afronden`);
    stopBoss()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}
