// Ruimt ruwe transcripten op. Draait standaard als proefrun.
//
//   node dist/purge-transcripts.js fixtures
//   node dist/purge-transcripts.js fixtures --apply
//   node dist/purge-transcripts.js ouder-dan 18 --apply
//   node dist/purge-transcripts.js alles --apply
//
// Zonder `--apply` verandert er niets; je krijgt alleen te zien welke bronnen
// geraakt zouden worden. Dit is de enige plek in het systeem die informatie
// weggooit, dus de drempel is met opzet hoog.
import { getDb, purgeTranscripts, type PurgeScope } from '@meetinghub/db';

const [selectie, ...rest] = process.argv.slice(2);
const apply = rest.includes('--apply');

function scopeVan(naam: string | undefined): PurgeScope {
  switch (naam) {
    case 'fixtures':
      return { kind: 'fixtures' };
    case 'ouder-dan': {
      const maanden = Number(rest.find((a) => !a.startsWith('--')));
      if (!Number.isFinite(maanden) || maanden <= 0) {
        throw new Error('gebruik: purge-transcripts ouder-dan <maanden> [--apply]');
      }
      return { kind: 'olderThanMonths', months: maanden };
    }
    case 'alles':
      return { kind: 'all' };
    default:
      throw new Error(
        'gebruik: purge-transcripts <fixtures|ouder-dan <maanden>|alles> [--apply]',
      );
  }
}

const scope = scopeVan(selectie);
const result = await purgeTranscripts(getDb(), scope, { apply });

if (result.gevonden.length === 0) {
  console.log('geen bronnen met ruwe tekst binnen deze selectie');
  process.exit(0);
}

for (const bron of result.gevonden) {
  console.log(`  ${bron.externalId ?? bron.id}  ${bron.titel ?? '(zonder titel)'}  ${bron.tekens} tekens`);
}

if (apply) {
  console.log(
    `\n${result.geleegd} bronnen geleegd, ${result.tekensVerwijderd} tekens ruwe tekst verwijderd.`,
  );
  console.log('De extracties blijven staan; de citaten zijn niet meer te toetsen.');
} else {
  console.log(
    `\nPROEFRUN — er is niets veranderd. ${result.gevonden.length} bronnen zouden geleegd worden.`,
  );
  console.log('Draai opnieuw met --apply om het echt te doen.');
}

process.exit(0);
