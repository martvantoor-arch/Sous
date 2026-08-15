# Evaluatieruns

Logboek bij `docs/eval.md`. Elke promptwijziging krijgt hier een regel, met
promptversie en model erbij. Zonder dit verbeter je op gevoel.

## Run 1 — 2026-08-14, extract-v1, claude-opus-5

**Deze run telt niet als score.** Lees eerst de waarschuwing hieronder.

| | Meeting 1, 12 aug | Meeting 2, 13 aug |
|---|---|---|
| Besluiten uit de sleutel gevonden | 4 van 4 | 7 van 7 |
| Toezeggingen gevonden | 10 van 10 | 5 van 5 |
| Open vragen gevonden | 3 van 3 | 4 van 4 |
| Risico's gevonden | 3 van 3 | 3 van 3 |
| Cijfers gevonden | 3 van 4 (zie bevinding 1) | n.v.t. |
| Eigenaarsfouten | 1 betwist (bevinding 2) | 0 |
| **Verzinsels** | **0** | **0** |
| Extra punten buiten de sleutel | 7, alle met citaat uit de bron | 4, alle met citaat uit de bron |
| Gevoelige passage correct gemarkeerd | n.v.t. | ja, niets uit geëxtraheerd |

Verzinsels zijn machinaal getoetst met `apps/worker/src/verify-quotes.ts`: 38 van
38 en 29 van 29 citaatfragmenten staan letterlijk in de ruwe bron.

### Waarom deze run niet als score telt

De extractie is niet door `packages/core` gegaan. Deze omgeving heeft geen
`ANTHROPIC_API_KEY`, dus de prompt is met de hand uitgevoerd door hetzelfde
model dat de pijplijn aanroept, en het resultaat is met
`apps/worker/src/import-extraction.ts` ingeladen langs dezelfde validatie en
opslag.

Zwaarder weegt dit: het model had `docs/eval.md` al gelezen voordat het
extraheerde. De antwoordsleutel zat in de context. Een hoge score bewijst
daarmee niets over de kwaliteit van `extract-v1`; hooguit dat de sleutel
navolgbaar is. Een geldige run vereist de pijplijn met een API sleutel, en een
call die de evaluatieset niet in zijn context heeft.

Wat deze run wél aantoont: de ingest, de validatie, de opslag, de
gevoeligmarkering en de brondetailpagina werken op echte data, en de
citaatcontrole is machinaal en herhaalbaar.

### Bevindingen over de evaluatieset zelf

**1. `docs/eval.md` spreekt zichzelf tegen over het testmoment.** Onder Cijfers
staat "21 of 22 augustus: testmoment nieuwe samples", terwijl de Valkuilen
zeggen dat de correcte uitkomst juist een open vraag over de leverdag is en geen
harde datum. Beide kunnen niet tegelijk goed zijn. Daar komt bij dat geen van
beide data klopt met de bron: 12 augustus 2026 is een woensdag, dus "volgende
week woensdag" is 19 augustus en de voorgestelde donderdag is 20 augustus. De
Pocket samenvatting noemt 22 augustus, een zaterdag. Voorstel: schrap de
cijferregel en houd de valkuil aan.

**2. Eigenaar van het kruidenblaadjespunt.** De sleutel wijst "checken of de
kruidenblaadjes fotografisch weggehaald kunnen worden" aan de leverancier toe.
In het transcript zegt de spreker die het gaat checken "maar ik ga even checken
of dat fotografie technisch wel kan", waarna de leverancier antwoordt "dus daar
kom jij bij ons dan nog op terug". Het gaat om de foto's die bij AH gemaakt
zijn. Dat leest als Marten. Graag beslissen wie gelijk heeft; zolang dat niet
vaststaat is dit punt geen bruikbare maat.

**3. De aanname over Pocket actiepunten klopt maar half.** `CLAUDE.md` en
`prompts/extract-v1.md` zeggen allebei dat Pocket stelselmatig alles aan "mij"
toewijst. Dat geldt voor meeting 1: vijf actiepunten, vijf keer `Assignee: me`.
In meeting 2 staan twee van de vijf op `Assignee: Other` mét de juiste naam
erbij: Bettina voor de TWI trainingen, Marit voor de stellingen. De prompt zegt
nu dat de eigenaar altijd fout is, waardoor correct signaal weggegooid wordt.
Voorstel: "de eigenaar is onbetrouwbaar, `me` betekent niets, een genoemde naam
is een aanwijzing" in plaats van "alles krijgt mij toegewezen".

### Bevindingen over de prompt en het model

**4. Eén bron, twee projecten.** Meeting 2 gaat over BLK implementatie én
Digitalisering ingangscontrole. Zowel `sources.project_id` als het `project`
veld in de promptoutput kent maar één project. De extractie koppelt nu alles aan
BLK en zet een triagevraag klaar over de ingangscontrolepunten. Dit moet vóór
sprint 2 beslist worden: project per bron, of project per geëxtraheerd punt.

**5. De leverancierszijde staat niet in `people`.** Acht van de veertien
toezeggingen in meeting 1 liggen bij de leverancier, en die krijgen terecht
`owner: null` omdat de prompt verbiedt zelf personen aan te maken. Gevolg: de
triagewachtrij loopt vol met dezelfde vraag. De goedkoopste oplossing is de
contactpersonen van de leverancier in de seed zetten.

**6. Ruis lekt in `nieuwe_termen`.** "Natura 2000" uit de uitweiding over
wildviaducten is in de nieuwe termen beland. De prompt noemt de ruisregel
expliciet bij toezeggingen, maar niet bij de andere categorieën. Voorstel: de
ruisregel één niveau omhoog halen, zodat hij voor de hele output geldt.

**7. Het woordenboek doet zijn werk.** Alle verhaspelingen die de evaluatieset
noemt zijn correct vertaald: "bij elkaar" en "BOK" naar BLK, "de taal" naar
Thaise curry, "Busbor in Johann" en "de bol" naar Boeuf Bourguignon, "patina" en
"de Tina" naar Bettina, "de TV's" naar TWI. De vakantiepraat op de eerste vijf
pagina's en de uitweiding over wolven en wildviaducten leverden geen punten op.

### De baseline draait op extract-v2, niet op v1

Na run 1 is besloten dat een bron aan meerdere projecten moet kunnen hangen, en
dat de extractie voorstellen moet doen voor personen die nog niet bestaan. `v1`
kan dat structureel niet: één project per bron, en een verbod op personen zonder
uitweg. Een precieze meting van v1 zou het verkeerde ding meten.

`extract-v2` voegt toe: een project per punt, `nieuwe_personen` als expliciet
voorstel, een gecorrigeerde uitspraak over de Pocket actiepunten (bevinding 3),
en de ruisregel die nu voor de hele output geldt (bevinding 6). Bevindingen 1 en
2 raken de sleutel zelf en wachten op een beslissing.

### Volgende run: run 2, de baseline op extract-v2

Dit is de run die telt. Hij draait op de deploy, met een echte API call, op een
model dat deze antwoordsleutel niet in zijn context heeft.

1. Fixtures in `eval/fixtures/`, manifest in `eval/manifest.json`.
2. `node dist/ingest-fixtures.js ../../eval/manifest.json`
3. De worker extraheert. Volg het in de logs.
4. `node dist/verify-quotes.js` — nul verzinsels is een harde eis.
5. Recall en eigenaarsfouten met de hand scoren tegen `docs/eval.md`, en de
   uitkomst hier onder Run 2 zetten.

Bij het scoren: meeting 2 hoort nu punten aan twee projecten toe te wijzen, en
de leverancierszijde van meeting 1 hoort als persoonsvoorstel terug te komen in
plaats van als acht keer dezelfde triagevraag.

Vanaf hier geldt de regel wel: **wijzig de prompt niet meer zonder run.** Elke
volgende versie zet je af tegen deze baseline.

Slaagt run 2 op de norm — minimaal 8 van de 10 punten per meeting en nul
verzinsels — dan is de poort naar sprint 2 open.
