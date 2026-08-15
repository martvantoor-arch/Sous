// Laadt een extractie die buiten de pijplijn is gedraaid, langs dezelfde
// validatie en opslag als de worker. Nodig om een promptversie te herdraaien
// op een omgeving zonder API sleutel, en om de evaluatieset te vullen.
//
//   node dist/import-extraction.js <sourceId> <bestand.json> [promptVersie] [model]
import { readFile } from 'node:fs/promises';
import { parseExtraction, persistExtraction } from '@meetinghub/core';

const [sourceId, file, promptVersion = 'extract-v1', model = 'claude-opus-5'] =
  process.argv.slice(2);

if (!sourceId || !file) {
  console.error('gebruik: import-extraction <sourceId> <bestand.json> [promptVersie] [model]');
  process.exit(1);
}

const result = parseExtraction(await readFile(file, 'utf8'));
const run = await persistExtraction(sourceId, result, { promptVersion, model });

console.log(
  `extractie ${run.extractionId} opgeslagen voor bron ${run.sourceId} ` +
    `(${promptVersion} op ${model})`,
);
process.exit(0);
