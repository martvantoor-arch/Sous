# Evaluatieruns

Logboek bij `docs/eval.md`. Elke promptwijziging krijgt hier een regel, met
promptversie en model erbij. Zonder dit verbeter je op gevoel.

## Wat er nog moet gebeuren

1. **`ANTHROPIC_EFFORT` op `high` houden.** Runs 4 en 5 draaiden op `medium` en
   zakken allebei op meeting 1. Vanaf run 6 staat hij weer op `high`; dat is de
   juiste stand.
2. **Scoor per categorie, niet op het totaal.** Runs 9 en 10 draaiden op exact
   dezelfde instelling en verschillen bijna een heel punt. Een verschil van een
   paar tienden tussen twee versies is ruis; een verschil in één categorie over
   twee runs is een bevinding. Zie run 10.

Wat er niet meer open staat: `extract-v5` is de versie die in gebruik is, en de
poort naar sprint 2 is open — de norm van 8 wordt op beide opnames gehaald, in
twee onafhankelijke runs, met nul verzinsels.

Kandidaat voor v6, als daar aanleiding voor is: op meeting 1 zijn het besluit om
niet te stunten met de prijs en de heroverweging van de fotografie van het
stoofvlees door geen enkele versie ooit gevonden. Kijk daarbij eerst of de
sleutel die twee wel scherp genoeg opschrijft.

`EXTRACTION_PROMPT` is er niet, en dat hoort ook niet. De standaard in
`packages/core/src/config.ts` bepaalt de promptversie, en die staat op
`extract-v4`. Run 5 draaide toch nog v3 omdat de worker op dat moment een build
van vóór die commit draaide.

**Let op bij het loggen van een run.** De promptversie volgt uit de code, dus
tussen pushen en meten zit een deploy. Kijk altijd eerst welke `promptVersie`
er in de extractie staat voordat je een run als meting van een nieuwe versie
opschrijft — anders schrijf je de verkeerde versie in dit logboek. Zo is run 5
ontstaan.

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

## Run 9 — 2026-08-16, extract-v5, claude-sonnet-5, effort `high`

Eerste run met een vingerafdruk in de logregel: `778383ca954f` op beide calls,
gelijk aan wat `loadPrompt` lokaal berekent. Geen twijfel meer over welke tekst
gedraaid heeft.

**Uitkomst: geslaagd op beide opnames, en het schoonste resultaat tot nu toe.**

| | Meeting 1 | Meeting 2 |
|---|---|---|
| Besluiten uit de sleutel | 2½ van 4 | **7 van 7** |
| Besluiten totaal | 1 (+2 afrondingen) | **7** |
| Toezeggingen | **10 van 10** | 4 van 5 |
| Open vragen | 2 van 3 | 3 van 4 |
| Risico's | 2 van 3 | 2 van 3 |
| Cijfers | 3 van 3 | n.v.t. |
| **Score** | **19½ van 23 ≈ 8,5** | **16 van 19 ≈ 8,4** |
| Citaten letterlijk | **30 van 30** | **25 van 25** |
| Verzinsels | **0** | **0** |
| Punten zonder citaat in de lijst | **0** | **0** |

### De drie wijzigingen doen precies wat ze moesten doen

**De verplaatsregel werkt.** De rekenregel over het BLK-aandeel — het punt dat v4
liet vallen — staat nu waar hij hoort:

> `open_vragen`: "Klopt de rekenregel voor het minimale BLK-aandeel bij
> samengestelde producten?"
> `triage`: "De rekensom loopt in het gesprek dood — wat is de juiste formule?"

**De minder strenge besluittoets herstelt meeting 2 volledig.** Zeven besluiten,
alle zeven uit de sleutel, en géén achtste. Dat is het beste resultaat op deze
as van alle negen runs: v3 leverde er elf of acht met vier te ruime, v4 er zes of
zeven met een gemiste. v5 heeft ze precies.

**Feedback met een afgesproken aanpassing werkt.** Meeting 1 gaat van zeven naar
tien van tien toezeggingen. De drie receptaanpassingen die v4 op beide runs
kwijtraakte staan er alle drie weer in, los van elkaar, elk met hun eigen
maaltijd:

> "Oma's Stoofvlees: saus/vlees weer meer binden"
> "Rode Kool: bekijken of het zuurgehalte weer iets zoeter richting origineel kan"
> "Thaise curry: binding aanpassen naar niveau tussen vorige en huidige versie"

En bij de rode kool staat de bijbehorende triagevraag ernaast — "is er
daadwerkelijk een aanpassing afgesproken, of blijft dit bij de constatering dat
hij zuurder is?" — precies zoals triage naast de lijst hoort te werken.

**De citaatregel is voor het derde meetpunt op rij honderd procent.** 30 van 30
en 25 van 25, en geen enkel punt in een lijst zonder citaat. De regel uit run 4
houdt stand.

### Wat er niet goed genoeg is

Meeting 2 blijft op 8,4 steken waar v3 op 9,2 en 9,5 zat, en dat komt door twee
punten die v3 wél had en v5 niet:

- **Het recallrisico is weg.** "Zonder volledige batchregistratie kan bij een
  recall niet exact bepaald worden welke charge betrokken is" staat in de
  sleutel en stond in run 3 en run 5. In run 9 staat het nergens — niet als
  risico, niet in triage, niet onder een andere naam. Het operationele risico
  van batchregistratie staat er wel; de reden waarom je het doet niet.
- **De botsing tussen de twee kleursystemen** — kleur per productiedag tegen
  kleur voor BLK — ontbreekt opnieuw. Alleen run 5 vond die.

Op meeting 1 ontbreken het besluit over niet stunten met de prijs, en de vraag of
de Boeuf Bourguignon mee kan in de zending van 21 augustus.

### Oordeel

**v5 gaat in gebruik.** Hij haalt de norm van 8 op beide opnames, is de enige
versie met nul te ruime besluiten, en herstelt de recall van meeting 1 volledig.

Tegen v3 is het een ruil en geen schone winst: v3 scoort hoger op meeting 2,
maar koopt dat met vier besluiten die er niet horen te staan. Die schrijven een
regel van het keurmerk weg alsof Foodconnect hem zelf genomen heeft, en dat is
een ander soort fout dan een gemist punt — het verzint geen feit maar wel een
beslissing. Voor een projectgeheugen weegt dat zwaarder.

De twee gemiste punten op meeting 2 zijn in run 10 herhaald en bleken ruis. Zie
hieronder.

## Run 10 — 2026-08-16, extract-v5, claude-sonnet-5, effort `high`

Zelfde prompt (`778383ca954f`), zelfde model, zelfde effort, zelfde opnames.
Bedoeld om één ding te beantwoorden: waren de twee gemiste punten van run 9 ruis
of structuur?

**Ruis. Allebei komen ze terug.**

| Meeting 2 | run 9 | run 10 |
|---|---|---|
| Recallrisico bij onvolledige batchregistratie | ontbreekt | **gevonden** |
| Botsing tussen de twee kleursystemen | ontbreekt | **gevonden** |
| Besluiten uit de sleutel | 7 van 7 | 7 van 7 |
| Risico's | 2 van 3 | **3 van 3** |
| Open vragen | 3 van 4 | 3½ van 4 |
| Score | 8,4 | **9,2** |

En andersom op meeting 1: daar zakt run 10 juist iets, op andere punten dan run 9
miste.

| | run 9 | run 10 |
|---|---|---|
| Meeting 1 | **8,5** | 8,0 |
| Meeting 2 | 8,4 | **9,2** |
| Citaten letterlijk | 30/30 en 25/25 | 22/23 en 24/24 |
| Verzinsels | 0 | 0 |

### De belangrijkste uitkomst gaat niet over v5 maar over de meetmethode

Twee runs op exact dezelfde instelling verschillen een half tot bijna een heel
punt, en missen niet dezelfde dingen. **Een enkele run kan een 8,4 niet van een
9,2 onderscheiden.** Dat betekent dat een totaalcijfer uit één run geen grond is
om een prompt op te wijzigen, en het betekent dat ik voorzichtiger moet zijn met
verschillen van een paar tienden tussen versies.

Wat wél robuust is, is de uitkomst per categorie. Die is over beide v5-runs
identiek, en precies daar zit de winst waarvoor v5 geschreven is:

| | v3 | v4 | v5 |
|---|---|---|---|
| Toezeggingen meeting 1 | 10 van 10 | 8 en 7 van 10 | **10 en 10 van 10** |
| Besluiten meeting 2 | 11 en 8 (4 te ruim) | 6 en 7 (1 gemist) | **7 en 7, precies** |
| Rekenregel als open vraag | ja | **twee keer weggelaten** | **twee keer aanwezig** |
| Datumval | doorstaan | doorstaan | **twee keer doorstaan** |

Op die vier punten liggen de versies wél uit elkaar, veel verder dan de ruis. Dat
is de basis waarop v5 blijft staan, niet het totaalcijfer.

### Wat er nog niet goed is

Eén citaat in run 10 is niet letterlijk: het model draait "Ja, dus de wens" om
naar "Dus ja, de wens" — exact dezelfde omkering als in run 3. Geen verzinsel,
wel de derde keer dat dit specifieke fragment misgaat.

Op meeting 1 blijven twee besluiten uit de sleutel structureel liggen over alle
runs heen: het besluit om niet te stunten met de prijs, en de heroverweging van
de fotografie van het stoofvlees. Die zijn nooit door een enkele versie gevonden.
Dat is de kandidaat voor v6, samen met de vraag of de sleutel op die twee punten
wel scherp genoeg is opgeschreven.

## Runs 6, 7 en 8 — 2026-08-16, extract-v4, claude-sonnet-5

Beide opnames twee keer op `extract-v4`. Alle vier de calls schrijven of lezen
7.912 cachetokens, dus ze draaiden byte voor byte dezelfde prompttekst.

**Uitkomst: v4 doet wat hij moest doen en scoort er op allebei de opnames
slechter door. Hij gaat niet in gebruik.**

| Meeting 2 | v3, run 3 | v3, run 5 | v4, run 6 | v4, run 7 |
|---|---|---|---|---|
| Besluiten uit de sleutel | 7 van 7 | 7 van 7 | 6 van 7 | 6 van 7 |
| Besluiten totaal | 11 | 8 | 6 | 7 |
| Toezeggingen | 4 van 5 | 4 van 5 | 4 van 5 | 4 van 5 |
| Open vragen | 3½ van 4 | **4 van 4** | 3 van 4 | 2½ van 4 |
| Risico's | 3 van 3 | 3 van 3 | 3 van 3 | 3 van 3 |
| Score | 9,2 | **9,5** | 8,4 | 8,2 |
| Outputtokens | 27.730 | 10.017 | 22.412 | 29.862 |
| Citaten letterlijk | 31 van 31 | 21 van 21 | 22 van 24 | 26 van 26 |
| Verzinsels | 0 | 0 | 0 | 0 |

| Meeting 1 | v3, run 3 | v4, run 6 | v4, run 8 |
|---|---|---|---|
| Besluiten uit de sleutel | 2 van 4 | 1½ van 4 | 1½ van 4 |
| Besluiten totaal | 3 | **1** | **1** |
| Toezeggingen | 10 van 10 | 8 van 10 | 7 van 10 |
| Open vragen | 3 van 3 | 2½ van 3 | 1½ van 3 |
| Risico's | 2½ van 3 | 3 van 3 | 2½ van 3 |
| Cijfers | 2 van 3 | 3 van 3 | 3 van 3 |
| Score | **8,5** | 7,8 | 6,7 |
| Citaten letterlijk | 26 van 27 | **33 van 33** | **24 van 24** |
| Verzinsels | 0 | 0 | 0 |

Meeting 1 laat het scherpst zien wat v4 doet: **één besluit**, waar v3 er drie
vond en de sleutel er vier kent. De besluittoets snijdt hier zo diep dat alleen
het E-nummerdossier overblijft; de rest wordt herverdeeld naar risico's en
toezeggingen of valt weg. De citaten zijn wel voor het eerst honderd procent
letterlijk, op allebei de opnames.

### Wat v4 goed doet

**De te ruime besluitgrens is dicht.** Elf besluiten worden er zes of zeven, en
de drie externe keurmerkregels die v3 als eigen besluit opschreef zijn weg. Dat
was de hele opzet van v4 en het werkt.

**En hij vindt een valkuil die v1 tot en met v3 alle drie misten.** `eval.md`
schrijft voor dat de samenvatting en het transcript elkaar tegenspreken over
waar BLK-producten in de stelling horen, en dat de juiste uitkomst een
triagevraag is over welke van de twee klopt. v4 doet dat, in beide runs:

> "Welke lezing over verticale plaatsing van BLK-producten klopt — bovenin
> (samenvatting) of op de grond (transcript)?"

Dat is precies het gedrag dat kernprincipe 5 vraagt, en geen enkele eerdere
versie kwam eraan.

### Waarom hij per saldo slechter scoort

De winst op besluiten wordt betaald met verlies op open vragen. Wat geen besluit
blijkt te zijn wordt **weggelaten in plaats van doorgeschoven**. De rekenregel
over het BLK-aandeel is het duidelijkste geval: v3 had hem als open vraag én in
triage, run 6 laat hem helemaal vallen, run 7 maakt er een risico van. De
sleutel wil een open vraag.

v4 zegt wel "vaak is het dan wel een toezegging, een open vraag of een risico —
kijk daar eerst", maar dat is een suggestie. Er staat nergens dat iets wat je uit
`besluiten` haalt ergens anders terecht **moet** komen.

Daar komt bij: v4 is ook duurder. Bij vergelijkbaar denkbudget levert hij twee
keer zoveel outputtokens als v3, vooral in triage — tien triagepunten in run 7
tegen vier bij v3.

### Wat er nu moet gebeuren

`extract-v4` gaat niet in gebruik zoals hij is. De volgende versie houdt de
besluittoets van v4 en de valkuildetectie, en voegt één regel toe: **een punt dat
je uit `besluiten` weghaalt, verdwijnt niet — het gaat naar de categorie waar het
wel hoort, en bij twijfel naar `open_vragen` met een triagevraag ernaast.** Dat
is dezelfde les als bij v3, waar triage de lijst opat: het model leest een
uitsluitingsregel als "weglaten" in plaats van "verplaatsen".

### Twee dingen die deze runs over de meetopstelling leerden

**Een promptversie is geen prompttekst.** Zie de waarschuwing bovenaan; sinds
`20dcdcf` logt elke call een vingerafdruk van de systeemprompt, zodat dit
achteraf vast te stellen is in plaats van af te leiden uit cachetokens.

**De worker doet één bron tegelijk, en dat is trager dan het lijkt.** Meeting 1
van run 6 stond ruim een half uur zonder één regel in `llm_calls`, en ik heb dat
eerst als een vastgelopen job gelezen. Dat was fout. De workerlogs laten zien wat
er werkelijk gebeurde:

```
07:11 start 44bcb66c   07:15 klaar in 238111ms
07:21 start 6ff6a11c   07:26 klaar in 306818ms
07:27 start fb2b93ef   07:32 klaar in 287852ms
07:32 start ad17fce2   07:36 klaar in 260722ms
```

Vier bronnen, strikt na elkaar, vier tot vijf minuten per stuk. `boss.work` staat
op `batchSize: 1`, dus een bron die als vierde binnenkomt begint pas na twintig
minuten. Er is geen `llm_calls` regel zolang de call niet klaar is, dus "in de
wachtrij" en "vastgelopen" zien er van buitenaf identiek uit.

Daar kwam bij dat elke push van mij de worker herstartte en het lopende werk
opnieuw in de wachtrij zette. De container in het logfragment hierboven start om
07:11; alles daarvoor was werk dat ik zelf onderbroken had.

Twee dingen om te onthouden. Reken op vier tot vijf minuten per meeting op hoge
effort, dus tien minuten voor een evaluatieronde van twee. En deploy niet terwijl
er een run loopt.

## Run 5 — 2026-08-16, extract-v3, claude-sonnet-5, effort `medium`

Bedoeld als eerste run van `extract-v4`, maar de worker draaide `extract-v3`:
de commit met v4 was tien minuten eerder gepusht en de deploy was nog niet rond.

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
