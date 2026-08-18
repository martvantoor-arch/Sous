# Mail binnenhalen

Marten stuurt een mail door naar een plusadres en die wordt een bron. Zelfde
tabel, zelfde wachtrij, zelfde reconciliatie als een meeting — kernprincipe 2.

## Hoe het loopt

```
doorgestuurde mail
   → Resend ontvangt (MX-record op het domein)
   → webhook email.received naar /api/ingest/mail   (alleen de envelop)
   → bron van type mail, zonder tekst, wachtrij mail.body
   → worker haalt de body op bij Resend             (de brief)
   → wachtrij source.extract
   → extract-mail-v1
   → reconcile-v2 en het geheugen
```

De splitsing in twee stappen is geen omweg maar een eis van Resend: de webhook
draagt **alleen metadata**, niet de body. Dat is hun keuze om te voorkomen dat
een mail met een bijlage van tien megabyte een webhook omver duwt.

Het pakt hier goed uit. De route hoeft nooit op een derde partij te wachten en
kan dus altijd binnen een seconde antwoorden; het ophalen staat in pg-boss en
probeert het bij een storing acht keer opnieuw met oplopende pauzes. Een mail
die verloren gaat krijg je nooit meer terug, dus dat is de kant om aan te
zitten.

## Instellen

1. **MX-record.** Zet in Resend het domein aan voor ontvangst en voeg het
   MX-record toe bij je DNS. Daarna komt élk adres op dat domein binnen —
   `wat-dan-ook@jouwdomein.nl` — en filter je zelf op het `to` veld.
2. **Webhook.** Maak in Resend een webhook naar
   `https://<jouw-app>/api/ingest/mail`, geabonneerd op `email.received`.
3. **Geheimen.** Zet `RESEND_WEBHOOK_SECRET` (begint met `whsec_`, staat bij de
   webhook) op de web service, en `RESEND_API_KEY` op **allebei** de services.
   De worker heeft de API-sleutel nodig om de body op te halen.

Zonder `RESEND_WEBHOOK_SECRET` weigert de route elke levering met een 503. Dat
is met opzet: liever geen ingest dan een open eindpunt waar iedereen bronnen in
kan duwen.

## Het plusadres is de routering

`marten+blk@jouwdomein.nl` betekent: deze mail hoort bij BLK.

Het label achter de `+` wordt gezocht op de projectcode, en daarna op de
aliassen van een project. Allebei hoofdletterongevoelig, want daar let niemand
op in een mailadres.

Matcht het label, dan wordt de bron aan dat project gekoppeld met **zekerheid
1.00**. Dat is de enige plek in het systeem waar die waarde voorkomt, en dat is
verdiend: elke andere koppeling is een gevolgtrekking van een model, deze is een
instructie die Marten zelf getypt heeft.

Matcht het label niet, dan gebeurt er precies niets automatisch. De mail komt
gewoon binnen, zonder project, en er komt een vraag in de triage wachtrij. Het
systeem maakt nooit zelf een project aan — ook niet als het label overduidelijk
een nieuw project beschrijft.

Geen plus in het adres is ook goed. Dan bepaalt de extractie het project, net
als bij een meeting.

## Dubbele levering

De bron krijgt `mail:<message-id>` als externe sleutel, met het RFC Message-ID
uit de mail zelf. Levert Resend dezelfde mail twee keer af — dat gebeurt, en het
hoort bij hoe webhooks werken — dan is de tweede levering een no-op. Ontbreekt
het Message-ID, dan valt hij terug op `resend:<email_id>`.

## Waarom mail een eigen prompt heeft

Eén pijplijn betekent één tabel, één wachtrij en één reconciliatie. Niet één
prompt voor elk medium.

`extract-v5` gaat over ongelabelde sprekers en over vaktermen die de
spraakherkenning verhaspelt. Die problemen heeft mail niet. Mail heeft er andere
voor terug:

- **De afzender is niet de auteur.** Marten stuurt naar zichzelf door, dus de
  buitenste afzender is bijna altijd Marten terwijl de toezegging van iemand
  anders is. Dit is de fout die bij mail het vaakst voorkomt en het langst
  onopgemerkt blijft.
- **Er zit geschiedenis in.** Een mailwissel draagt de vorige berichten mee. Die
  zijn context, geen nieuws — maar ze mogen wel bewijs van afronding leveren.
- **Bijlagen zijn er niet.** We krijgen hoogstens de bestandsnamen. "De cijfers
  staan in de bijlage" is dus een open vraag, nooit een cijfer.
- **Verzoek is geen toezegging.** Mail bestaat voor een groot deel uit vragen aan
  een ander. Wie die allemaal als toezegging opneemt, vult de opvolgingslijst
  met beloftes die niemand gedaan heeft.

Het outputcontract is letterlijk hetzelfde, dus alles erna — reconciliatie,
triage, stilteregel — merkt geen verschil.

## Wat er gemeten is

`apps/worker/src/eval-mail.ts`, 32 controles, allemaal geslaagd:

```
node dist/eval-mail.js
```

Adressen lezen, plusadressering, html naar tekst, de handtekeningcontrole en het
routeren van een label naar een project. Dat zijn allemaal regels en geen
oordelen, dus deze set hoort altijd te slagen — niet meestal.

De handtekeningcontrole zit er nadrukkelijk in. Dit is het slot op een eindpunt
dat van buiten bereikbaar is, en elk geval in die groep is een manier waarop
iemand anders dan Resend binnen zou komen: een aangepaste body, een andere
sleutel, ontbrekende headers, een oude levering die opnieuw wordt afgespeeld.

**Wat er nog niet gemeten is:** de extractiekwaliteit van `extract-mail-v1`.
Daar is een evaluatieset voor nodig zoals `docs/eval.md` die voor meetings heeft,
en die kan pas als er echte doorgestuurde post is om tegen te ijken. De prompt is
geschreven op wat er bij een opname misging, niet op wat er bij mail misgaat —
dat weten we pas na de eerste tien mails.
