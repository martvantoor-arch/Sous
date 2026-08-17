// Markeert toezeggingen die te lang niet genoemd zijn als stil.
//
//   node dist/stilte.js [dagen]
//
// Bedoeld om dagelijks te draaien. Dit is een regel, geen model: of iets al een
// tijd niet langskwam is een feit uit de database.
//
// Sluit niets af. Stilte is een signaal, geen status — de toezegging blijft
// openstaan en wordt alleen zichtbaar gemaakt op de opvolgingspagina.
import { markeerStilteNa } from '@meetinghub/core';

const dagen = Number(process.argv[2] ?? 21);
if (!Number.isFinite(dagen) || dagen <= 0) {
  throw new Error('gebruik: stilte [dagen]');
}

const aantal = await markeerStilteNa(dagen);
console.log(
  aantal === 0
    ? `geen toezeggingen langer dan ${dagen} dagen onbesproken`
    : `${aantal} toezegging${aantal === 1 ? '' : 'en'} als stil gemarkeerd na ${dagen} dagen`,
);
process.exit(0);
