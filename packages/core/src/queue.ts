// Wachtrij via pg-boss: dezelfde Postgres, geen Redis erbij.
import PgBoss from 'pg-boss';

export const EXTRACT_QUEUE = 'source.extract';

export interface ExtractJob {
  sourceId: string;
  force?: boolean;
}

let boss: PgBoss | undefined;
let starting: Promise<PgBoss> | undefined;

export function getBoss(): Promise<PgBoss> {
  if (boss) return Promise.resolve(boss);
  if (!starting) {
    starting = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL ontbreekt');
      const instance = new PgBoss({ connectionString: url, schema: 'pgboss' });
      // Alleen de kern loggen. pg-boss geeft bij een verbroken verbinding het
      // hele Client-object mee, en dat is honderd regels waarin een echte fout
      // onzichtbaar wordt. Een verbroken idle verbinding is bovendien normaal:
      // de pool maakt hem opnieuw aan en het werk loopt door.
      instance.on('error', (err) => {
        const bericht = err instanceof Error ? err.message : String(err);
        const code = (err as { code?: string })?.code;
        console.error(`[pg-boss] ${bericht}${code ? ` (${code})` : ''}`);
      });
      await instance.start();
      await instance.createQueue(EXTRACT_QUEUE);
      boss = instance;
      return instance;
    })();
  }
  return starting;
}

/**
 * Hoe lang een extractie mag duren voordat pg-boss hem als vastgelopen
 * beschouwt. De standaard is vijftien minuten, en dat is te krap geworden: een
 * extractie op hoge effort duurde in run 7 al ruim vijf minuten, en niets
 * breekt de lopende Claude-call af als de job verloopt. De job gaat dan opnieuw
 * de wachtrij in terwijl de eerste nog draait, en die stapelen op.
 *
 * Een half uur is ruim boven alles wat we gemeten hebben. Loopt een job daar
 * overheen, dan is er echt iets mis en mag hij verlopen.
 */
const JOB_EXPIRY_MINUTES = 30;

export async function enqueueExtraction(job: ExtractJob): Promise<string | null> {
  const instance = await getBoss();
  // singletonKey houdt dubbele webhookleveringen uit de wachtrij.
  return instance.send(EXTRACT_QUEUE, job, {
    singletonKey: job.force ? undefined : job.sourceId,
    expireInMinutes: JOB_EXPIRY_MINUTES,
    retryLimit: 3,
    retryBackoff: true,
  });
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = undefined;
    starting = undefined;
  }
}
