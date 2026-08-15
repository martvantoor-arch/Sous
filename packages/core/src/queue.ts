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
      instance.on('error', (err) => console.error('[pg-boss]', err));
      await instance.start();
      await instance.createQueue(EXTRACT_QUEUE);
      boss = instance;
      return instance;
    })();
  }
  return starting;
}

export async function enqueueExtraction(job: ExtractJob): Promise<string | null> {
  const instance = await getBoss();
  // singletonKey houdt dubbele webhookleveringen uit de wachtrij.
  return instance.send(EXTRACT_QUEUE, job, {
    singletonKey: job.force ? undefined : job.sourceId,
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
