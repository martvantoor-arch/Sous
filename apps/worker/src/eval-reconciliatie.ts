// Draait de reconciliatieset uit docs/eval-reconciliatie.md en scoort hem.
//
//   node dist/eval-reconciliatie.js
//
// Leest de toezeggingen uit de database en houdt ze naast de verwachte
// uitkomsten. Bedoeld om ná het binnenhalen van meeting 1 en de synthetische
// bron van 26 augustus te draaien.
//
// Matcht op trefwoorden, niet op de letterlijke tekst: het model formuleert een
// toezegging elke keer anders, en een score die daarop stukloopt meet de
// verkeerde dingen.
import { getDb, commitments, desc } from '@meetinghub/db';

interface Verwachting {
  nummer: number;
  omschrijving: string;
  trefwoorden: string[];
  verwacht: string;
}

/** Uit docs/eval-reconciliatie.md. Volgorde en nummering komen daarvandaan. */
const VERWACHT: Verwachting[] = [
  { nummer: 1, omschrijving: 'Feedback keuring per mail', trefwoorden: ['feedback', 'mail'], verwacht: 'afgerond' },
  { nummer: 2, omschrijving: 'Voorstel promotionele ondersteuning', trefwoorden: ['promot'], verwacht: 'afgerond' },
  { nummer: 3, omschrijving: 'Mijlpalenplanning opvragen', trefwoorden: ['mijlpalen', 'planning'], verwacht: 'bijgewerkt' },
  { nummer: 4, omschrijving: 'Vleesleverancier concurrent navragen', trefwoorden: ['leverancier', 'vlees'], verwacht: 'open' },
  { nummer: 5, omschrijving: 'Reden dikkere folie checken', trefwoorden: ['folie'], verwacht: 'vervallen' },
  { nummer: 6, omschrijving: "Binding Oma's Stoofvlees", trefwoorden: ['stoofvlees', 'binding'], verwacht: 'afgerond' },
  { nummer: 7, omschrijving: 'Binding Thaise curry', trefwoorden: ['curry'], verwacht: 'bijgewerkt' },
  { nummer: 8, omschrijving: 'Rode kool minder zuur', trefwoorden: ['rode kool'], verwacht: 'stil-of-open' },
  { nummer: 9, omschrijving: 'Kruidenblaadjes van de foto', trefwoorden: ['blaad', 'foto'], verwacht: 'stil-of-open' },
  { nummer: 10, omschrijving: 'Impact Nutri-score C naar B', trefwoorden: ['nutri'], verwacht: 'open' },
];

const NIEUW = [
  { omschrijving: 'Allergenenverklaring aanleveren', trefwoorden: ['allergen'] },
  { omschrijving: 'Houdbaarheidstest zuurkool', trefwoorden: ['houdbaarheid'] },
];

const rijen = await getDb()
  .select({
    id: commitments.id,
    wat: commitments.what,
    status: commitments.status,
    citaat: commitments.closedQuote,
  })
  .from(commitments)
  .orderBy(desc(commitments.lastSeenAt));

const zoek = (trefwoorden: string[]) =>
  rijen.filter((r) => trefwoorden.every((t) => r.wat.toLowerCase().includes(t.toLowerCase())));

let goed = 0;
let fout = 0;
let tenOnrechteAfgesloten = 0;

console.log(`${rijen.length} toezeggingen in het geheugen\n`);
console.log('BESTAANDE PUNTEN UIT MEETING 1');

for (const v of VERWACHT) {
  const gevonden = zoek(v.trefwoorden);

  if (gevonden.length === 0) {
    console.log(`  ${v.nummer}. ${v.omschrijving}: NIET GEVONDEN — verwacht ${v.verwacht}`);
    fout += 1;
    continue;
  }
  if (gevonden.length > 1) {
    console.log(
      `  ${v.nummer}. ${v.omschrijving}: ${gevonden.length}x aanwezig (dubbel opgenomen) — ` +
        gevonden.map((g) => `[${g.status}]`).join(' '),
    );
    fout += 1;
    continue;
  }

  const rij = gevonden[0]!;
  const klopt =
    v.verwacht === 'stil-of-open' ? ['stil', 'open'].includes(rij.status) : rij.status === v.verwacht;

  // De harde eis: iets afsluiten wat niet afgesloten hoort te zijn.
  const onterechtDicht =
    ['afgerond', 'vervallen'].includes(rij.status) &&
    !['afgerond', 'vervallen'].includes(v.verwacht);
  if (onterechtDicht) tenOnrechteAfgesloten += 1;

  console.log(
    `  ${v.nummer}. ${v.omschrijving}: ${rij.status} ` +
      `(verwacht ${v.verwacht}) ${klopt ? 'goed' : 'FOUT'}` +
      (onterechtDicht ? '  ← TEN ONRECHTE AFGESLOTEN' : ''),
  );

  klopt ? (goed += 1) : (fout += 1);
}

console.log('\nNIEUWE PUNTEN UIT DE DERDE BRON');
let nieuweGevonden = 0;
for (const n of NIEUW) {
  const gevonden = zoek(n.trefwoorden);
  console.log(`  ${n.omschrijving}: ${gevonden.length > 0 ? 'aanwezig' : 'ONTBREEKT'}`);
  if (gevonden.length > 0) nieuweGevonden += 1;
}

console.log('\nUITKOMST');
console.log(`  ${goed} van ${VERWACHT.length} bestaande punten met de juiste status`);
console.log(`  ${nieuweGevonden} van ${NIEUW.length} nieuwe toezeggingen opgenomen`);
console.log(`  ${tenOnrechteAfgesloten} ten onrechte afgesloten`);

const geslaagd = tenOnrechteAfgesloten === 0 && goed >= 8 && nieuweGevonden === NIEUW.length;
console.log(`\n${geslaagd ? 'GESLAAGD' : 'GEZAKT'} op de norm uit docs/eval-reconciliatie.md`);

process.exit(geslaagd ? 0 : 1);
