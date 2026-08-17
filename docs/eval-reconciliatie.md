# Evaluatieset voor de reconciliatie

Aparte set naast `docs/eval.md`, want hij meet iets anders. De extractieset
vraagt: haalt het model uit één bron wat erin zit? Deze set vraagt: herkent het
systeem dat een toezegging uit een láter gesprek over een bestaande gaat?

Draai deze set bij elke wijziging aan de reconciliatieprompt of aan de
stilteregel.

## Waarom er een verzonnen meeting in zit

De twee echte augustusopnames gaan over verschillende projecten. Meeting 1 gaat
over de AH private label maaltijden, meeting 2 over BLK-procedures. Er is
nauwelijks overlap tussen hun toezeggingen, en daarmee valt er weinig te
reconciliëren.

Daarom staat er een **derde bron in `eval/synthetisch/`, en die is geschreven,
niet opgenomen**. Hij doet zich voor als een terugkoppeling van 26 augustus die
de punten uit meeting 1 langsloopt.

Wees eerlijk over wat dat betekent:

- **Zwakker** dan de echte set op ruis. Een geschreven transcript heeft niet de
  echte rommeligheid van spraakherkenning. Ik heb verhaspelingen ingebouwd die
  ook in de echte opnames voorkomen — "de taal" voor Thaise curry, "Busbor in
  Johann" voor Boeuf Bourguignon, "maelstone planning" voor mijlpalenplanning —
  maar het blijft nagebootst.
- **Sterker** dan de echte set op dekking. Alle vijf de uitkomsten komen erin
  voor, plus twee toezeggingen die met opzet niet genoemd worden zodat de
  stilteregel iets te doen heeft. Zo'n gesprek heb je in het echt zelden zo
  compleet.

Zodra er een echte tweede meeting over hetzelfde project is, vervangt die deze.
Tot dan is dit beter dan niets meten.

## De opstelling

1. Meeting 1 van 12 augustus binnenhalen en laten extraheren. Daarmee staat er
   een geheugen.
2. De synthetische bron van 26 augustus binnenhalen. Die triggert de
   reconciliatie.
3. Toezeggingen teruglezen via `GET /api/toezeggingen`.
4. Daarna de stilteregel draaien met een korte drempel.

## Wat eruit moet komen

Genummerd naar de toezeggingen uit `docs/eval.md`, meeting 1.

| # | Toezegging uit meeting 1 | Verwachte uitkomst | Waarom |
|---|---|---|---|
| 1 | Feedback van de keuring per mail delen | **afgerond** | "Die heb ik vorige week vrijdag gemaild. Die is de deur uit." |
| 2 | Voorstel promotionele ondersteuning mailen | **afgerond** | "Die is ook verstuurd." |
| 3 | Mijlpalenplanning opvragen bij collega's | **bijgewerkt** | Opgevraagd maar nog niet binnen; schuift een week op. Nadrukkelijk géén afronding. |
| 4 | Navragen welke vleesleverancier de concurrent gebruikt | **zelfde** | "Ik blijf er achteraan." Opnieuw genoemd, niets veranderd. |
| 5 | Checken of er een reden is voor de dikkere folie | **vervallen** | "Dat doen we niet meer." |
| 6 | Binding Oma's Stoofvlees verhogen | **afgerond** | "Die is klaar. Daar hoeven we niks meer aan te doen." |
| 7 | Binding Thaise curry aanpassen | **bijgewerkt** | Aangepast maar nu te nat; nieuwe poging voor 2 september. |
| 8 | Rode kool minder zuur maken | **niet genoemd** | Moet blijven staan en later door de stilteregel opvallen. |
| 9 | Kruidenblaadjes fotografisch weghalen | **niet genoemd** | Idem. |
| 10 | Impact Nutri-score C naar B bepalen | **zelfde** | "Dat loopt nog." |

Daarnaast horen er **twee nieuwe toezeggingen** bij te komen:

- Allergenenverklaring aanleveren voor de vier maaltijden, vóór 9 september
- Houdbaarheidstest zuurkoolmaaltijd inplannen

## Valkuilen die de reconciliatie moet overleven

- **Vooruitgang is geen afronding.** Punt 3 en 7 zijn allebei opgepakt en
  allebei nog niet klaar. Wie die afrondt, sluit het geheugen te vroeg.
- **Stoppen is geen afronden.** Punt 5 gaat niet door. Dat is `vervallen`, niet
  `afgerond`; het verschil telt als je later terugkijkt waarom iets niet gebeurd
  is.
- **Twee bindingen zijn twee toezeggingen.** Punt 6 en 7 lijken sterk op elkaar
  — zelfde handeling, ander product. Ze mogen niet op elkaar gematcht worden.
- **De verhaspelingen moeten door het woordenboek heen.** "De taal" is de Thaise
  curry, "Busbor in Johann" is de Boeuf Bourguignon. Matcht het model op de
  letterlijke tekst in plaats van op het onderwerp, dan valt hij hierover.
- **Niet genoemd is niet afgerond.** Punt 8 en 9 komen niet voor in de derde
  bron. Ze moeten open blijven staan. Een reconciliatie die ze op eigen houtje
  afsluit is de ergste fout die dit systeem kan maken.

## Meetmethode

Per uitkomst tellen:

- **juist gekoppeld**: aan de goede bestaande toezegging
- **verkeerd gekoppeld**: aan een andere bestaande toezegging — erger dan niet
  koppelen, want dan overschrijft hij iets dat klopte
- **ten onrechte nieuw**: bestond al, staat er nu twee keer in
- **ten onrechte afgesloten**: harde nul vereist, net als verzinsels bij de
  extractie

En daarna, na het draaien van de stilteregel met drempel 1 dag: punt 8 en 9
horen op `stil` te staan, en verder niets uit de derde bron.

## Slaagnorm

- **nul ten onrechte afgesloten toezeggingen** — harde eis
- minimaal 8 van de 10 bestaande punten met de juiste uitkomst
- beide nieuwe toezeggingen opgenomen
- precies de twee niet-genoemde punten als stil gemarkeerd

## Runs

### Run 1 — 17 augustus, reconcile-v1, extract-v5

Meeting 1 binnengehaald (13 openstaande toezeggingen), daarna de synthetische
bron van 26 augustus. Uitkomst: 16 toezeggingen, `{open: 13, bijgewerkt: 2,
vervallen: 1}`.

**7 van de 10 goed. Nul ten onrechte afgesloten — de harde eis gehaald.** Beide
nieuwe toezeggingen opgenomen. De drie valkuilen die het meest telden gingen
goed: punt 3 en 7 bleven `bijgewerkt` (vooruitgang is geen afronding), punt 5
werd `vervallen` en niet `afgerond`, en de twee bindingen zijn niet op elkaar
gematcht.

De drie fouten waren alle drie hetzelfde soort fout: punt 1, 2 en 6 hoorden
`afgerond` te zijn en bleven `open`.

**Oorzaak: de code, niet de prompt.** De extractie had ze alle drie correct
herkend, met citaat en al:

```
AFRONDINGEN:
  - Binding van Oma's Stoofvlees aangepast en goedgekeurd | expliciet
      "Ja, die is klaar. Daar hoeven we niks meer aan te doen."
  - Feedback van de keuring delen per mail | expliciet
      "Die heb ik vorige week vrijdag gemaild. Die is de deur uit."
  - Voorstel promotionele ondersteuning versturen | expliciet
      "Die is ook verstuurd. Zelfde mail eigenlijk."
```

Maar `materialiseer()` las alleen `result.toezeggingen` en gaf alleen die lijst
aan de reconciliatie mee. `result.afrondingen` werd nergens gelezen. Het bewijs
van afronding lag klaar en werd weggegooid.

Dat is logisch te verklaren en daarom leerzaam: een afgeronde toezegging wordt in
een gesprek niet als toezegging genoemd. "Die heb ik vrijdag gemaild" is geen
belofte. De extractie zet zo'n zin dus terecht in `afrondingen` — en precies
daardoor kwam hij nooit bij de pass aan die er iets mee kon.

Hieruit volgt `reconcile-v2` (afrondingen gaan mee, met `soort` en `type`, plus
een `geen_match`-uitkomst voor een afronding die nergens bij hoort) en de
codewijziging die beide lijsten achter elkaar aanbiedt.
