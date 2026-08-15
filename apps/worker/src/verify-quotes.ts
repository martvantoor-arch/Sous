// Toetst de opgeslagen extracties op verzinsels, zonder iets opnieuw te
// draaien. Exitcode 1 zodra er één citaat niet in de bron staat.
//
//   node dist/verify-quotes.js [sourceId ...]     zonder argument: alle bronnen
import { getDb, sources, inArray } from '@meetinghub/db';
import { checkQuotes } from './quotes.js';

const db = getDb();
const wanted = process.argv.slice(2);

const rows = await db
  .select({ id: sources.id })
  .from(sources)
  .where(wanted.length ? inArray(sources.id, wanted) : undefined);

let totalBad = 0;

for (const { id } of rows) {
  const check = await checkQuotes(id);
  if (check.promptVersion === null) continue;

  totalBad += check.fabricated;
  console.log(
    `${check.title} (${check.promptVersion}): ` +
      `${check.checked - check.fabricated}/${check.checked} citaatfragmenten letterlijk in de bron` +
      (check.fabricated ? ` — ${check.fabricated} VERZONNEN` : ' — schoon'),
  );
  for (const bad of check.problems) console.error(`  ${bad.path}: ${bad.fragment.slice(0, 100)}`);
}

process.exit(totalBad === 0 ? 0 : 1);
