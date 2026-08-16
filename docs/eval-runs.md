# Evaluatieruns

Logboek bij `docs/eval.md`. Elke promptwijziging krijgt hier een regel, met
promptversie en model erbij. Zonder dit verbeter je op gevoel.

## Wat er nog moet gebeuren

Twee variabelen op de worker in Railway, en dan is `extract-v4` te meten:

| Variabele | Nu | Moet worden | Waarom |
|---|---|---|---|
| `ANTHROPIC_EFFORT` | `medium` | `high` | Runs 4 en 5 zakken allebei op meeting 1. Zie hieronder. |
| `EXTRACTION_PROMPT` | `extract-v3` | `extract-v4` | Staat vast op de deploy, dus de standaard in de code doet niets. Run 5 draaide daardoor per ongeluk v3. |

`extract-v4` staat klaar in `packages/core/src/prompts` en is gedeployed. Zolang
`EXTRACTION_PROMPT` op `extract-v3` staat wordt hij niet gebruikt.

## Heeft de sleutel drie besluiten gemist?

Terechte vraag na run 3: meeting 2 leverde elf besluiten waar de sleutel er
zeven kent. Dat kan twee dingen betekenen. Of de prompt is te ruim, of de
sleutel is te krap. Hieronder de vier extra punten, elk teruggezocht in het
transcript.

**Nagekeken, en de sleutel blijft staan.** Alle zeven besluiten uit de sleutel
zitten in run 3, en er is geen achtste besluit dat de sleutel over het hoofd
heeft gezien. De vier extra punten zijn van drie soorten:

| Extra punt uit run 3 | Wat het echt is |
|---|---|
| Alle producten worden in de EFA-app geregistreerd | Zelfde besluit als "alle batchnummers noteren", fijner gesneden. Prima, geen fout. |
| Ingangscontrole incl. temperatuur wordt in de EFA-app vastgelegd | Beschrijving van wat de ingangscontrole inhoudt. In de bron staat "dat zou ook in die EFA kunnen vastzetten" — een mogelijkheid, geen knoop. |
| BLK-aandeel moet twee keer zo groot zijn als het niet-BLK dierlijke aandeel | Een regel van het keurmerk die iemand uitlegt ("omdat zij dat als een regel hebben gesteld"), en de rekensom eromheen loopt in het gesprek dood. Dit is exact de valkuil uit `docs/eval.md`: hoort een open vraag te worden. |
| Bedrijven mogen zelf kiezen waar BLK in de productnaam staat | Ook een regel van het keurmerk, als antwoord op "maar mag het er ook voor staan?". Niemand kiest hier iets. |

De rode draad: drie van de vier zijn **extern gegeven regels en beschrijvingen
die als eigen besluit zijn opgeschreven**. Niemand hakt een knoop door. Dat is
precies waar `extract-v4` op mikt met de toets "kun je het moment aanwijzen
waarop de knoop werd doorgehakt?".

Wat de vraag wél opleverde: het derde punt hoorde in `open_vragen` te staan en
stond in `besluiten` — met de juiste triagevraag ernaast. Dat is geen te ruime
besluitgrens maar een verkeerde bak. De sleutel had het goed.

## Run 5 — 2026-08-16, extract-v3, claude-sonnet-5, effort `medium`

Bedoeld als eerste run van `extract-v4`, maar de worker draaide `extract-v3`:
`EXTRACTION_PROMPT` staat vast op de deploy en overrulet de standaard uit
`packages/core/src/config.ts`. Zie "Wat er nog moet gebeuren" onderaan.

Daarmee is dit een **tweede meting van precies dezelfde instelling als run 4**,
en dat is toevallig het nuttigste wat er nu kon gebeuren: het voorbehoud bij
run 4 was dat één opname per instelling geen bewijs is.

| | Meeting 1 | Meeting 2 |
|---|---|---|
| Outputtokens | 11.583 | 10.017 |
| Duur | 116s | 104s |
| Score | **16 van 23 ≈ 7,0** | **18 van 19 ≈ 9,5** |
| Citaten letterlijk | **25 van 25** | **21 van 21** |
| Verzonnen feiten | **0** | **0** |

**Het voorbehoud vervalt: de uitkomst van run 4 is systematisch.** Meeting 1
mist opnieuw exact dezelfde drie toezeggingen, en opnieuw niet in triage maar
helemaal:

- binding Oma's Stoofvlees verhogen
- binding Thaise curry aanpassen
- rode kool minder zuur maken

Twee onafhankelijke runs, dezelfde drie gaten, allebei ruim onder de norm van 8.
Dat is geen ruis. Wat wegvalt zijn steeds de productaanpassingen met 19 augustus
als deadline — inhoudelijk de kern van die meeting.

Er komt een tweede regressie bij: **de datumval is weer gezakt.** Run 5 legt
22 augustus vast als hard cijfer én zet de dag in triage als onbesliste vraag.
Precies de fout die run 2 maakte en run 3 had opgelost. Half goed is hier fout.

Meeting 2 gaat de andere kant op en scoort met 9,5 het hoogst van alle geldige
runs: alle zeven besluiten, alle vier de open vragen — inclusief de botsing
tussen de twee kleursystemen, die geen enkele eerdere run vond — en alle drie de
risico's. Er blijft één te ruim besluit staan, de rekenregel over het BLK-
aandeel, en die staat tegelijk correct als open vraag. Dat is nog steeds het
defect waar `extract-v4` op mikt, alleen niet meer vier keer maar één keer.

### Wat dit samen met run 4 zegt

De twee meetings reageren tegengesteld op minder denkbudget, consistent over
twee runs:

| | `high` (run 3) | `medium` (runs 4 en 5) |
|---|---|---|
| Meeting 1, gestructureerd? nee | 8,5 | 6,5 en 7,0 |
| Meeting 2, gestructureerd? ja | 9,2 | 8,9 en 9,5 |

Een overleg met duidelijke knopen wordt er beter van; minder denkbudget gaat
vooral af van het uitweiden. Een terugkoppeling waarin losse punten langskomen
wordt er slechter van, want die vindt je alleen door het hele stuk uit te kammen.

De helft van je meetings is van het tweede soort. Daarom: `high`.

## Run 4 — 2026-08-16, extract-v3, claude-sonnet-5, effort `medium`

Zelfde prompt en zelfde model als run 3, alleen `ANTHROPIC_EFFORT` van `high`
naar `medium`. Bedoeld om één ding te meten: wat kost het aan kwaliteit als je
de grootste kostenknop omdraait.

**Uitkomst: fors goedkoper, en gezakt op meeting 1.**

| | Meeting 1 | Meeting 2 |
|---|---|---|
| Outputtokens (was op `high`) | 13.726 (31.056) | 12.737 (27.730) |
| Duur | 143s (was 292s) | 130s (was 268s) |
| Besluiten uit de sleutel | 1½ van 4 (was 2) | **7 van 7** |
| Toezeggingen gevonden | **7 van 10** (was 10) | 4 van 5 |
| Open vragen gevonden | 1½ van 3 (was 3) | 3 van 4 |
| Risico's gevonden | 2 van 3 (was 2½) | **3 van 3** |
| Cijfers gevonden | **3 van 3** (was 2) | n.v.t. |
| Citaten letterlijk | 22 van 23 | **25 van 25** |
| Verzonnen feiten | **0** | **0** |
| Score | **15 van 23 ≈ 6,5** | 17 van 19 ≈ 8,9 |

Recall is geteld zoals in run 2 en 3: een punt telt mee waar het ook landt, in
de lijst of in triage.

### 56% minder outputtokens

Dat is de opbrengst, en hij is groot. Ruwweg twee derde van de rekening bestond
uit denktokens; `medium` halveert dat. Op tien meetings per week zakt Sonnet 5
van $22,48 naar ongeveer $11 per maand, zonder één regel code.

### Meeting 2 wordt er beter van, meeting 1 slechter

Meeting 2 is op `medium` **netter dan op `high`**. Acht besluiten in plaats van
elf, en juist de drie punten uit de tabel hierboven zijn verdwenen. De rekenregel
staat nu waar hij hoort: als open vraag, met de triagevraag ernaast. Het
denkbudget dat wegviel ging blijkbaar vooral op aan uitweiden.

Meeting 1 verliest daarentegen inhoud die er wel toe doet. Drie toezeggingen
zijn spoorloos — niet in de lijst, niet in triage:

- binding Oma's Stoofvlees verhogen
- binding Thaise curry aanpassen, minder droog
- rode kool minder zuur maken

Dat zijn niet de minste. Het zijn precies de drie receptaanpassingen met 19
augustus als deadline, oftewel de reden dat die meeting gehouden werd. Ook het
besluit over de fotografie van het stoofvlees en de open vraag of Nutri-score B
een must is verdwijnen. Daar staat één winst tegenover: de cijfers zijn nu
compleet, alle drie de data met de juiste ISO-datum erbij.

Het patroon is navolgbaar. Meeting 2 is een gestructureerd overleg met duidelijke
knopen. Meeting 1 is een terugkoppeling waarin tien losse punten langskomen die
je alleen vindt als je het hele stuk uitkamt. Minder denkbudget kost je vooral
het uitkammen.

### Wat dit betekent

**Zet `ANTHROPIC_EFFORT` terug op `high` voordat dit echt in gebruik gaat.** Een
6,5 op meeting 1 zakt onder de norm van 8, en een gemiste toezegging is precies
wat dit systeem hoort te voorkomen. De besparing is echt, maar je koopt hem met
de recall op het type meeting dat je het vaakst hebt.

Voorbehoud bij deze run: één opname per instelling is geen serie. Run 5 heeft
datzelfde meetpunt herhaald en komt op hetzelfde uit, inclusief exact dezelfde
drie gemiste toezeggingen. Daarmee vervalt het voorbehoud.

### Nieuwe bevinding

**11. Een toezegging zonder citaat wordt toch opgeschreven.** Meeting 2 levert
"Mastergegevens en stellingvinkjes controleren" met een leeg `citaat` en als
`owner_raw` letterlijk "Actiepunt van opnamedienst wijst 'me' toe, geen
expliciete tekstpassage in transcript teruggevonden". Het model is eerlijk over
wat het niet vond, en zet het punt er dan alsnog in. Het komt puur uit een Pocket
actiepunt, en dat is signaal, geen waarheid. Een punt zonder citaat hoort alleen
in triage. Kandidaat voor v5.

## Run 3 — 2026-08-15, extract-v3, claude-sonnet-5

**Uitkomst: geslaagd op de citaateis, en een grote sprong op recall.**

| | Meeting 1 | Meeting 2 |
|---|---|---|
| Toezeggingen in de lijst | **11** (was 3) | **4** (was 1) |
| Waarvan uit de sleutel | ~9 van 10 | 4 van 5 |
| Besluiten | 3 van 4 | 11 gevonden, 7 uit de sleutel |
| Open vragen | 4 | 5 |
| Risico's | 4 | 3 van 3 |
| Citaten letterlijk | 26 van 27 | **31 van 31** |
| Verzonnen feiten | **0** | **0** |
| `owner_raw` gevuld | **overal** | **overal** |

### Wat de drie wijzigingen deden

**Triage naast de lijst in plaats van ervoor in de plaats** is de grote winst.
Meeting 1 gaat van 3 naar 11 toezeggingen. De punten waren er in run 2 ook al,
maar stonden alleen als vraag in triage. Nu staan ze in hun categorie mét de
vraag ernaast, precies zoals bedoeld.

**`owner_raw` altijd vullen** werkt. Elke toezegging draagt nu het letterlijke
fragment waaruit de eigenaar volgt:

> `owner_raw: "Nee, maar kan ik wel even vragen."`
> `owner_raw: "Marit is daar verantwoordelijk en het onderhouden is Marit ook"`

Daarmee is een toewijzing te controleren zonder het transcript erbij te halen.

**Verantwoordelijkheid als besluit én toezegging** werkt: Marit en Bettina
staan nu in allebei.

**De datumval is nu helemaal doorstaan.** Meeting 1 legt geen 22 augustus meer
vast als hard cijfer; alleen 19 augustus en de systeemdeadline blijven staan, en
de leverdag staat als open vraag.

### Wat er nog niet goed is

Meeting 2 levert 11 besluiten waar de sleutel er 7 kent. Alle citaten zijn
letterlijk, dus het zijn geen verzinsels, maar de scheidslijn tussen besluit en
constatering is te ruim. Dat is de kandidaat voor v4.

Eén citaat in meeting 1 is nog niet letterlijk: het model draait "Ja, dus de
wens" om naar "Dus ja, de wens". Van vier niet-letterlijke citaten in run 2 naar
één in run 3.

### Kosten, gemeten

Uit `llm_calls`, dus geen schatting. Gemiddeld per meeting op v3: 25.962
prompt-tokens en 29.393 outputtokens.

| Model | Per meeting | Per maand | Per jaar |
|---|---|---|---|
| Haiku 4.5 | $0,17 | $7,49 | $90 |
| Sonnet 5 (introprijs t/m 31 aug) | $0,35 | $14,99 | $180 |
| Sonnet 5 (normale prijs) | $0,52 | $22,48 | $270 |
| Opus 5 | $0,87 | $37,47 | $450 |

Bij tien meetings per week. **77% van de rekening is output, en 85% van die
output is denkwerk** — ruwweg twee derde van alles wat je betaalt zijn
denktokens. De grootste kostenknop is dus niet het model maar `ANTHROPIC_EFFORT`,
dat nu op `high` staat. Dat is het eerste dat je moet meten voordat je aan het
model gaat sleutelen.

v3 kost 38% meer dan v2, omdat hij meer punten vindt en dus meer schrijft. Dat
is de prijs van de recall die je terugkreeg.


## Run 2 — 2026-08-15, extract-v2, claude-sonnet-5

De eerste geldige meting. Gedraaid op de deploy: de opnames zijn via de echte
webhook binnengekomen, de worker heeft ze geëxtraheerd met zijn eigen sleutel,
en het resultaat is via `GET /api/bronnen/<id>` teruggelezen. Het model had de
antwoordsleutel niet in context.

**Uitkomst: gezakt.** Geen van beide opnames haalt 8 van de 10.

| | Meeting 1, 12 aug | Meeting 2, 13 aug |
|---|---|---|
| Besluiten | 2 van 4 | **7 van 7** |
| Toezeggingen in de lijst | 3 van 10 | 1 van 5 |
| Toezeggingen incl. triage | 8 van 10 | 2 van 5 |
| Open vragen incl. triage | 2 van 3 | 3 van 4 |
| Risico's | 2 van 3 | **3 van 3** |
| Cijfers | 3 van 4 | n.v.t. |
| Verzonnen feiten | **0** | **0** |
| Niet-letterlijke citaten | 3 van 24 | 1 van 18 |
| Score incl. triage | 17 van 24 ≈ 7,1 | 15 van 19 ≈ 7,9 |

Model: `claude-sonnet-5`, niet de standaard `claude-opus-5`. `ANTHROPIC_MODEL`
staat zo op de worker. Dat hoort bij deze meting; een volgende run op Opus is
een andere meting.

### Wat goed ging

Meeting 2 haalt alle zeven besluiten en alle drie de risico's. De
multiprojectverdeling werkt: de batchregistratie en de recall gaan naar
Digitalisering ingangscontrole, de stellingen en de kleurcode naar BLK, uit
dezelfde opname. De gevoelige wervingspassage is gemarkeerd en er is niets uit
geëxtraheerd. Het woordenboek doet zijn werk.

Nul verzonnen feiten, machinaal getoetst.

### De dominante oorzaak van het zakken

**De triageregel eet de output op.** De prompt zegt "alles onder 0.75 gaat
automatisch naar triage", en het model leest dat als *verplaatsen* in plaats van
*ook melden*. Vijf van de zeven triagepunten van meeting 1 zijn toezeggingen die
gewoon in de lijst hadden moeten staan, mét de vraag erbij:

> [toezegging] Wie zegt toe deze feedback per mail te delen?
> [toezegging] Wie gaat dit navragen? Eigenaarschap niet met zekerheid af te leiden.

Het model heeft die punten dus wél gevonden. Het heeft ze alleen verkeerd
gerubriceerd. Op de lijst alleen is de recall 3 van 10; tel je triage mee, dan is
het 8 van 10. Dat is geen begripsprobleem maar een instructieprobleem.

### Drie andere bevindingen

**8. `owner_raw` blijft leeg zodra `owner` gevuld is.** Alle drie de
toezeggingen van meeting 1 hebben een uuid als eigenaar en een lege `owner_raw`.
De prompt vraagt `owner_raw` alleen te vullen als de eigenaar onbekend is.
Gevolg: je kunt een toewijzing niet controleren zonder het transcript erbij te
halen, terwijl dat juist het punt is waarop dit systeem het vaakst faut zit.
Voorstel: `owner_raw` altijd vullen met wat er letterlijk stond.

**9. Verantwoordelijkheden worden besluit óf toezegging, niet allebei.** In
meeting 2 zijn "Marit richt de stellingen in" en "Bettina legt de TWI trainingen
vast" correct als besluit vastgelegd, maar niet als toezegging. Daardoor zakt de
toezeggingenscore naar 1 van 5 terwijl de inhoud er wel is. Een afspraak over wie
iets gaat doen is allebei.

**10. Citaten worden aan elkaar geplakt en opgepoetst.** Vier citaten staan niet
letterlijk in de bron. Geen daarvan is verzonnen: twee plakken twee echte,
niet-aaneengesloten beurten aan elkaar, één zet een punt midden in een zin, en
één maakt van het ASR-woord "zonder" het woord "zonde". De prompt vraagt om het
letterlijke citaat; dat moet strenger.

**De datumval half doorstaan.** Het model zet terecht een open vraag klaar dat
de dag tussen woensdag en donderdag wisselt zonder besluit — en legt tegelijk
22 augustus vast als hard cijfer. Half goed is hier fout.

### Naar extract-v3

Drie wijzigingen, in volgorde van verwachte opbrengst:

1. Triage naast de lijst, niet in plaats ervan. Een punt onder 0.75 hoort in
   zijn eigen categorie mét een triagevraag erbij.
2. `owner_raw` altijd vullen.
3. Een verantwoordelijkheid die is toegewezen is zowel besluit als toezegging.

Plus scherper op letterlijke citaten en op het niet vastleggen van een cijfer
waarover in dezelfde adem een open vraag bestaat.


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

### Hoe run 2 gedraaid is

Dit was de run die telt. Hij draait op de deploy, met een echte API call, op een
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
