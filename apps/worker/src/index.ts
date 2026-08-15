// Verwerkingsservice. Draait los van de web service zodat een lange extractie
// nooit een webhook laat aflopen.
import { EXTRACT_QUEUE, extractSource, getBoss, stopBoss, type ExtractJob } from '@meetinghub/core';
import { requireEnv } from './env.js';

requireEnv();

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
