// Controleert de onderdelen van de mailpijplijn die geen model nodig hebben.
//
//   node dist/eval-mail.js
//
// Adressen lezen, het plusadres uithalen, html naar tekst, en het routeren van
// een label naar een project. Allemaal regels, geen oordelen — dus deze set
// hoort altijd te slagen, niet meestal.
//
// De routeringstest maakt een eigen project aan met een marker in de naam en
// ruimt alleen dat weer op. Draait dit per ongeluk tegen de echte database,
// dan verdwijnt er niets van Marten.
import { createHmac } from 'node:crypto';
import { getDb, projects, like, inArray } from '@meetinghub/db';
import {
  controleerSvix,
  htmlNaarTekst,
  kiesRoutering,
  leesAdres,
  leesAdressen,
  routeringsLabel,
  zoekProjectVoorLabel,
} from '@meetinghub/core';

const MARKER = '[mail-eval]';

let goed = 0;
let fout = 0;

function toets(naam: string, werkelijk: unknown, verwacht: unknown): void {
  const a = JSON.stringify(werkelijk);
  const b = JSON.stringify(verwacht);
  if (a === b) {
    goed += 1;
    console.log(`  goed  ${naam}`);
  } else {
    fout += 1;
    console.log(`  FOUT  ${naam}\n          kreeg    ${a}\n          verwacht ${b}`);
  }
}

console.log('ADRESSEN LEZEN');
toets('naam met haakjes', leesAdres('Marten van Toor <marten+blk@example.nl>'), {
  ruw: 'Marten van Toor <marten+blk@example.nl>',
  adres: 'marten+blk@example.nl',
  naam: 'Marten van Toor',
});
toets('kaal adres', leesAdres('bibi@ah.nl'), {
  ruw: 'bibi@ah.nl',
  adres: 'bibi@ah.nl',
  naam: null,
});
toets('naam tussen aanhalingstekens', leesAdres('"Vries, Bibi de" <bibi@ah.nl>'), {
  ruw: '"Vries, Bibi de" <bibi@ah.nl>',
  adres: 'bibi@ah.nl',
  naam: 'Vries, Bibi de',
});
toets('hoofdletters gaan eruit', leesAdres('<Marten@Example.NL>').adres, 'marten@example.nl');
// Onleesbaar is niet hetzelfde als afwezig: de ruwe tekst blijft altijd staan.
toets('onleesbare afzender', leesAdres('undisclosed-recipients'), {
  ruw: 'undisclosed-recipients',
  adres: '',
  naam: null,
});
toets('lege lijst blijft leeg', leesAdressen(null), []);
toets('lege strings vallen weg', leesAdressen(['', '  ', 'a@b.nl']).length, 1);

console.log('\nPLUSADRESSERING');
toets('gewoon label', routeringsLabel('marten+blk@example.nl'), 'blk');
toets('geen plus', routeringsLabel('marten@example.nl'), null);
toets('plus zonder label', routeringsLabel('marten+@example.nl'), null);
toets('hoofdletters worden klein', routeringsLabel('marten+BLK@example.nl'), 'blk');
// Twee plussen blijven één label. Dat matcht dan nergens op en belandt in de
// triage — beter dan de helft weggooien en op iets verkeerds uitkomen.
toets('twee plussen', routeringsLabel('marten+blk+urgent@example.nl'), 'blk+urgent');
toets(
  'kiest het adres mét label',
  kiesRoutering(leesAdressen(['team@example.nl', 'marten+diepvries@example.nl']))?.label,
  'diepvries',
);
toets('geen enkel label', kiesRoutering(leesAdressen(['team@example.nl'])), null);

console.log('\nHTML NAAR TEKST');
toets(
  'blokken worden regels',
  htmlNaarTekst('<p>Hallo Marten,</p><p>De verklaring is klaar.</p>'),
  'Hallo Marten,\nDe verklaring is klaar.',
);
toets('scripts verdwijnen', htmlNaarTekst('<p>Tekst</p><script>alert(1)</script>'), 'Tekst');
toets('lijsten krijgen streepjes', htmlNaarTekst('<ul><li>een</li><li>twee</li></ul>'), '- een\n- twee');
toets('entiteiten terug naar tekens', htmlNaarTekst('<p>Kip &amp; ei &lt;3</p>'), 'Kip & ei <3');
toets('breaks worden regels', htmlNaarTekst('regel een<br>regel twee'), 'regel een\nregel twee');

console.log('\nHANDTEKENING');
// Dit is het slot op een eindpunt dat van buiten bereikbaar is. Elke regel
// hieronder is een manier waarop iemand anders dan Resend binnen zou komen.
const GEHEIM = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const BODY = '{"type":"email.received","data":{"email_id":"abc"}}';

const tekenen = (body: string, id: string, ts: number, geheim = GEHEIM) =>
  createHmac('sha256', Buffer.from(geheim.replace(/^whsec_/, ''), 'base64'))
    .update(`${id}.${ts}.${body}`, 'utf8')
    .digest('base64');

const nu = Math.floor(Date.now() / 1000);
const geldig = (over: Partial<Record<'id' | 'timestamp' | 'signature', string | null>> = {}) => ({
  id: 'msg_1',
  timestamp: String(nu),
  signature: `v1,${tekenen(BODY, 'msg_1', nu)}`,
  ...over,
});

toets('geldige levering', controleerSvix(BODY, geldig(), GEHEIM), null);
toets(
  'body veranderd',
  controleerSvix(`${BODY} `, geldig(), GEHEIM),
  'handtekening klopt niet',
);
toets(
  'andere sleutel',
  controleerSvix(BODY, geldig(), 'whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
  'handtekening klopt niet',
);
toets('geen headers', controleerSvix(BODY, geldig({ signature: null }), GEHEIM), 'svix-headers ontbreken');
// Zonder tijdstempelcontrole kan wie één geldige levering onderschept hem
// eeuwig blijven afspelen.
const oud = nu - 600;
toets(
  'oude levering',
  controleerSvix(BODY, { id: 'msg_1', timestamp: String(oud), signature: `v1,${tekenen(BODY, 'msg_1', oud)}` }, GEHEIM)?.startsWith('tijdstempel'),
  true,
);
toets(
  'tijdstempel niet leesbaar',
  controleerSvix(BODY, geldig({ timestamp: 'gisteren' }), GEHEIM),
  'tijdstempel niet leesbaar',
);
// Tijdens een sleutelwissel staan er twee handtekeningen in de header. Eén die
// klopt is genoeg.
toets(
  'meerdere handtekeningen, één goed',
  controleerSvix(BODY, geldig({ signature: `v1,onzin v1,${tekenen(BODY, 'msg_1', nu)}` }), GEHEIM),
  null,
);
// Een andere svix-id hoort de handtekening ongeldig te maken: die id zit in de
// getekende tekst.
toets(
  'id gewisseld',
  controleerSvix(BODY, geldig({ id: 'msg_2' }), GEHEIM),
  'handtekening klopt niet',
);

console.log('\nROUTERING NAAR EEN PROJECT');
const db = getDb();
await opruimen();

const [opCode] = await db
  .insert(projects)
  .values({ name: `${MARKER} Diepvries`, code: 'EVALDV', aliases: ['vriesmaaltijden'] })
  .returning({ id: projects.id });

toets('matcht op code', (await zoekProjectVoorLabel('evaldv')).projectId, opCode!.id);
toets('code is hoofdletterongevoelig', (await zoekProjectVoorLabel('EVALDV')).via, 'code');
toets('matcht op alias', (await zoekProjectVoorLabel('Vriesmaaltijden')).via, 'alias');
// Een onbekend label maakt niets aan. Het levert een triagevraag op, en dat
// gebeurt een laag hoger; hier hoort alleen 'niet gevonden' uit te komen.
toets('onbekend label vindt niets', await zoekProjectVoorLabel('bestaatniet'), {
  label: 'bestaatniet',
  projectId: null,
  projectNaam: null,
  via: null,
});
toets('leeg label vindt niets', (await zoekProjectVoorLabel('   ')).projectId, null);

await opruimen();

console.log(`\n${goed} goed, ${fout} fout`);
console.log(fout === 0 ? 'GESLAAGD' : 'GEZAKT');
process.exit(fout === 0 ? 0 : 1);

async function opruimen(): Promise<void> {
  const eigen = await db
    .select({ id: projects.id })
    .from(projects)
    .where(like(projects.name, `${MARKER}%`));
  if (eigen.length > 0) {
    await db.delete(projects).where(inArray(projects.id, eigen.map((r) => r.id)));
  }
}
