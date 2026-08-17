// Controleert de stilteregel tegen een echte database.
//
//   node dist/eval-stilte.js
//
// Kernprincipe 4 is de belangrijkste regel in dit systeem: een toezegging die
// niet meer genoemd wordt is niet afgerond, die is stil. Zo'n regel wil je niet
// pas voor het eerst zien werken op het moment dat hij er echt toe doet.
//
// Dit is geen modelmeting maar een controle op SQL. De regel kent geen
// zekerheid en geen twijfel: of iets al een tijd niet langskwam is een feit.
// Daarom hoort hier ook geen score bij maar een harde uitkomst.
//
// De testrijen dragen een marker in hun tekst en worden voor en na alleen op
// die marker opgeruimd. Draait dit per ongeluk tegen de echte database, dan
// verdwijnt er niets van Marten — maar de regel raakt dan wel zijn toezeggingen,
// precies zoals de dagelijkse job om 06:00 dat ook doet. Het script zegt het
// eerlijk als het die situatie tegenkomt.
import { getDb, commitments, changeLog, eq, like, inArray, and } from '@meetinghub/db';
import { markeerStilteNa } from '@meetinghub/core';

const MARKER = '[stilte-eval]';
const DREMPEL = 21;

interface Geval {
  wat: string;
  status: string;
  dagenGeleden: number | null;
  gesloten?: boolean;
  verwacht: string;
  waarom: string;
}

const GEVALLEN: Geval[] = [
  {
    wat: 'rode kool minder zuur',
    status: 'open',
    dagenGeleden: 30,
    verwacht: 'stil',
    waarom: 'lang niet genoemd, staat nog open',
  },
  {
    wat: 'kruidenblaadjes van de foto',
    status: 'open',
    dagenGeleden: 40,
    verwacht: 'stil',
    waarom: 'idem, nog langer geleden',
  },
  {
    wat: 'mijlpalenplanning navragen',
    status: 'bijgewerkt',
    dagenGeleden: 25,
    verwacht: 'stil',
    waarom: 'bijgewerkt telt net zo goed mee als open',
  },
  {
    wat: 'gisteren nog besproken',
    status: 'open',
    dagenGeleden: 2,
    verwacht: 'open',
    waarom: 'binnen de drempel, moet met rust gelaten worden',
  },
  {
    wat: 'al afgerond, lang geleden',
    status: 'afgerond',
    dagenGeleden: 60,
    gesloten: true,
    verwacht: 'afgerond',
    waarom: 'afgesloten blijft afgesloten; stilte heropent niets',
  },
  {
    wat: 'vervallen, lang geleden',
    status: 'vervallen',
    dagenGeleden: 60,
    gesloten: true,
    verwacht: 'vervallen',
    waarom: 'idem',
  },
  {
    wat: 'al stil, blijft stil',
    status: 'stil',
    dagenGeleden: 60,
    verwacht: 'stil',
    waarom: 'geen tweede logregel voor iets dat al stil was',
  },
  {
    wat: 'nooit teruggekomen',
    status: 'open',
    dagenGeleden: null,
    verwacht: 'stil',
    waarom:
      'nooit een levensteken gehad; zonder de coalesce op createdAt zou juist deze nooit opvallen',
  },
];

const db = getDb();
const dagenGeleden = (n: number) => new Date(Date.now() - n * 86_400_000);

await opruimen();

const vreemd = await db.select({ id: commitments.id }).from(commitments);
if (vreemd.length > 0) {
  console.log(
    `let op: er staan al ${vreemd.length} andere toezeggingen in deze database. ` +
      'De regel raakt die ook — net als de dagelijkse job. Alleen de eigen rijen worden beoordeeld.\n',
  );
}

for (const g of GEVALLEN) {
  const gezien = g.dagenGeleden === null ? null : dagenGeleden(g.dagenGeleden);
  await db.insert(commitments).values({
    what: `${MARKER} ${g.wat}`,
    status: g.status,
    statusSource: 'meeting',
    lastSeenAt: gezien,
    closedAt: g.gesloten ? dagenGeleden(g.dagenGeleden ?? 60) : null,
    // Zonder levensteken telt het aanmaakmoment. Dat moet dus ook oud zijn,
    // anders meet het laatste geval niets.
    createdAt: gezien ?? dagenGeleden(50),
  });
}

const gemarkeerd = await markeerStilteNa(DREMPEL);
console.log(`markeerStilteNa(${DREMPEL}) markeerde ${gemarkeerd} toezegging(en)\n`);

const na = await db
  .select({ id: commitments.id, wat: commitments.what, status: commitments.status })
  .from(commitments)
  .where(like(commitments.what, `${MARKER}%`));

const stand = new Map(na.map((r) => [r.wat.slice(MARKER.length + 1), r.status]));
const eigenIds = na.map((r) => r.id);

let fout = 0;
for (const g of GEVALLEN) {
  const werkelijk = stand.get(g.wat);
  const goed = werkelijk === g.verwacht;
  if (!goed) fout += 1;
  console.log(
    `  ${goed ? 'goed' : 'FOUT'}  ${g.wat}: ${werkelijk} (verwacht ${g.verwacht}) — ${g.waarom}`,
  );
}

// De harde eis: de regel sluit niets af. Alleen wat al dicht was is dicht.
const dicht = na.filter((r) => ['afgerond', 'vervallen'].includes(r.status)).length;
const geenNieuweAfsluiting = dicht === 2;

const log = await db
  .select({ id: changeLog.entityId, naar: changeLog.newValue, herkomst: changeLog.origin })
  .from(changeLog)
  .where(and(eq(changeLog.entityType, 'toezegging'), inArray(changeLog.entityId, eigenIds)));

const alleenRegel = log.every((l) => l.herkomst === 'regel' && l.naar === 'stil');

// Nog een keer draaien mag niets opleveren: wat stil is, is al stil.
const nogmaals = await markeerStilteNa(DREMPEL);

console.log('');
console.log(`  afgesloten na de regel: ${dicht} — ${geenNieuweAfsluiting ? 'goed' : 'FOUT'}`);
console.log(`  logregels: ${log.length}, alleen herkomst 'regel' naar 'stil': ${alleenRegel}`);
console.log(`  tweede run markeerde ${nogmaals} (hoort 0 te zijn)`);

await opruimen();

const geslaagd = fout === 0 && geenNieuweAfsluiting && alleenRegel && nogmaals === 0;
console.log(`\n${geslaagd ? 'GESLAAGD' : 'GEZAKT'}`);
process.exit(geslaagd ? 0 : 1);

/** Ruimt uitsluitend de eigen rijen op, aan het begin en aan het eind. */
async function opruimen(): Promise<void> {
  const eigen = await db
    .select({ id: commitments.id })
    .from(commitments)
    .where(like(commitments.what, `${MARKER}%`));
  if (eigen.length === 0) return;

  const ids = eigen.map((r) => r.id);
  await db
    .delete(changeLog)
    .where(and(eq(changeLog.entityType, 'toezegging'), inArray(changeLog.entityId, ids)));
  await db.delete(commitments).where(inArray(commitments.id, ids));
}
