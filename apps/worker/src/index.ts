// Verwerkingsservice. Draait los van de web service zodat een lange extractie
// nooit een webhook laat aflopen.
import {
  EXTRACT_QUEUE,
  MAIL_BODY_QUEUE,
  STILTE_QUEUE,
  extractSource,
  getBoss,
  haalMailBody,
  markeerStilteNa,
  plangStilte,
  stopBoss,
  type ExtractJob,
  type MailBodyJob,
  type StilteJob,
} from '@meetinghub/core';
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

  // De fout hier vangen en opnieuw gooien: pg-boss bewaart hem wel bij de job,
  // maar zet er niets over in de log. Een bron die blijft staan zonder dat er
  // iets gebeurt is anders een stille storing — je ziet alleen dat er niets is.
  let run;
  try {
    run = await extractSource(sourceId, { force });
  } catch (err) {
    console.error(
      `[extractie] MISLUKT ${sourceId} na ${Date.now() - started}ms:`,
      err instanceof Error ? err.stack ?? err.message : err,
    );
    throw err;
  }

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

// De body van een inkomende mail ophalen. Aparte wachtrij en niet in de route:
// een webhook die op een derde partij wacht kan aflopen, en een mail die
// daardoor verloren gaat krijg je nooit meer terug. Hier gaat hij bij een
// storing gewoon opnieuw de rij in.
await boss.work<MailBodyJob>(MAIL_BODY_QUEUE, { batchSize: 1 }, async ([job]) => {
  if (!job) return;
  const { sourceId, emailId } = job.data;
  try {
    await haalMailBody(sourceId, emailId);
  } catch (err) {
    console.error(
      `[mail] body ophalen MISLUKT voor ${sourceId}:`,
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
});

// De stilteregel. Geen model, geen wachtrij vol werk: één update-statement dat
// zichtbaar maakt wat al een tijd niet meer genoemd is. Sluit niets af.
await boss.work<StilteJob>(STILTE_QUEUE, { batchSize: 1 }, async ([job]) => {
  const dagen = job?.data?.dagen ?? 21;
  const aantal = await markeerStilteNa(dagen);
  console.log(`[stilte] ${aantal} toezegging(en) stil na ${dagen} dagen`);
});

await plangStilte();

console.log(
  `worker luistert op ${EXTRACT_QUEUE}, ${MAIL_BODY_QUEUE} en ${STILTE_QUEUE}; ` +
    'stilte staat op 06:00',
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`${signal} ontvangen, afronden`);
    stopBoss()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}
