# MeetingHub

Persoonlijke projecthub voor Marten van Toor, Operations Manager bij Foodconnect
(producent van maaltijden voor Maaltijd Thuis van Albert Heijn).

Doel: meeting transcripten en doorgestuurde mail omzetten naar een levend
projectgeheugen. Marten wijzigt zelf geen statussen. Dat gebeurt automatisch op
basis van bronnen, of in gesprek met de assistent.

## Kernprincipes

1. **Ruwe tekst is heilig, extracties zijn wegwerpbaar.** Elke bron wordt
   onaangetast bewaard. Bij elke extractie leggen we promptversie en model vast,
   zodat we alles opnieuw kunnen draaien als de prompt beter wordt.
2. **Alles is een bron.** Meeting, mail, notitie en document zitten in dezelfde
   tabel met een type. Er is precies een verwerkingspijplijn.
3. **De samenvatting leidt, het transcript bewijst.** Pocket levert per opname
   een samenvatting en een transcript. De samenvatting is aantoonbaar
   nauwkeuriger op namen en vaktermen. Extractie gebeurt op de samenvatting;
   het transcript wordt gebruikt voor citaten, nuance en detectie van punten die
   de samenvatting mist.
4. **Nooit stilzwijgend sluiten.** Een toezegging die niet meer genoemd wordt is
   niet afgerond, die is stil. Stilte is een signaal, geen status.
5. **Elke mutatie heeft een herkomst.** meeting, mail, gesprek of regel. Altijd
   traceerbaar naar een bron en waar mogelijk een letterlijk citaat.
6. **Bij twijfel naar de triage wachtrij.** Die wachtrij is geen backlog maar de
   agenda van het ochtendgesprek.

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind
- Postgres op Railway met pgvector
- Aparte worker service, wachtrij via pg-boss (geen Redis)
- Anthropic API voor extractie en reconciliatie
- Resend voor magic link login en voor de uitgaande briefings
- Postmark of Resend inbound voor doorgestuurde mail (fase 4)
- Deploy: Railway, alle services in een project

## Repo structuur

```
apps/web        Next.js, UI en API routes
apps/worker     verwerking, cron jobs
packages/db     drizzle schema, migraties, queries
packages/core   extractie, reconciliatie, prompts
```

## Datamodel in het kort

`sources` is de spil. Daaronder hangen `decisions`, `commitments`,
`open_questions`, `risks`, `metrics` en `notes`. `terms` is het
vaktermenwoordenboek dat bij elke extractie wordt meegegeven. `triage_queue`
vangt alles met lage zekerheid. `change_log` legt elke mutatie vast.

Zie `db/schema.sql`.

## Kwaliteitseisen die uit echte data volgen

Getest op twee echte Pocket opnames (12 en 13 augustus 2026). Wat daar misging
moet het systeem opvangen:

- **Sprekers zijn niet gelabeld.** Elk blok heet simpelweg `Speaker:`. Leid
  eigenaarschap af uit de inhoud, nooit uit de spreker. Bij twijfel: triage.
- **Nederlandse ASR verhaspelt vaktermen structureel.** BLK wordt "bij elkaar"
  of "BOK". Boeuf Bourguignon wordt "Busbor in Johann". Thaise curry wordt "de
  taal". TWI wordt "de TV's". Bettina wordt "patina". Geef daarom altijd de
  `terms` tabel mee in de prompt.
- **Pocket action items zijn onbetrouwbaar op eigenaar.** Alles krijgt
  `Assignee: me`, ook waar het gesprek expliciet iemand anders aanwijst. Neem ze
  mee als signaal, nooit als waarheid.
- **Meetings bevatten lange irrelevante stukken.** Vakantiepraat, een uitweiding
  over wildviaducten, een rekendiscussie die nergens landt. Extractie moet ruis
  herkennen en negeren.
- **Ambiguiteit hoort in de output.** Waar het gesprek onduidelijk is, hoort een
  open vraag te ontstaan, geen verzonnen besluit.

## Gevoelige segmenten

Sommige delen van meetings horen niet in een langdurig geheugen. Voor de
verwerking draait een classificatiestap die segmenten markeert als gevoelig:

- werving en selectie, beoordelingen van kandidaten of medewerkers
- ziekte, verzuim, persoonlijke omstandigheden
- arbeidsvoorwaarden, salaris, ontslag
- juridische geschillen

Gevoelige segmenten worden niet geextraheerd en niet geembed. De ruwe bron
behoudt een marker met de reden. Standaard bewaartermijn voor ruwe transcripten:
18 maanden, daarna alleen de gestructureerde extracties.

## Werkafspraken voor Claude Code

- Schrijf geen migraties met de hand, gebruik drizzle-kit.
- Elke prompt staat in `packages/core/prompts` als los bestand met een
  versienummer in de bestandsnaam. Nooit inline in code.
- Elke Claude call logt: prompt versie, model, tokens, duur, kosten.
- Bouw geen UI voor het wijzigen van status. Dat is expres.
- Nederlandse veldnamen in de UI, Engelse in de database.
- Eerst de evaluatieset laten slagen, dan pas verder bouwen. Zie `docs/eval.md`.

## Bouwvolgorde

1. Schema, Pocket webhook, extractie, brondetailpagina
2. Projecten, personen, termen, koppeling, triage wachtrij
3. Reconciliatie van toezeggingen, opvolgingsweergave
4. Mail inbound via plusadressering
5. Levende projectbrief, ochtendbriefing, vrijdagdigest
