# MeetingHub

Projectgeheugen voor Marten van Toor. Zet Pocket transcripten en doorgestuurde
mail om in een levende status per project.

## Repo

```
apps/web        Next.js 15, ingest route en brondetailpagina
apps/worker     pg-boss worker, draait de extractie
packages/db     drizzle schema, migraties, seed
packages/core   prompts, extractie, wachtrij, Claude client
db/             schema.sql en seed.sql, de bron voor packages/db
docs/eval.md    de evaluatieset, de poort naar de volgende sprint
```

## Lokaal draaien

Vereist Node 22, pnpm 10, en een Postgres met `vector` en `pg_trgm`.

```bash
pnpm install
cp .env.example .env      # vul DATABASE_URL en ANTHROPIC_API_KEY
pnpm build                # packages eerst: web en worker lezen dist/
pnpm db:migrate
pnpm db:seed              # personen, projecten en het woordenboek
pnpm dev:worker           # in de ene terminal
pnpm dev:web              # in de andere
```

Een bron aanbieden zonder Pocket:

```bash
BODY='{"id":"test-1","title":"Testmeeting","recorded_at":"2026-08-12T09:30:00Z",
       "summary":"...","transcript":"Speaker: ..."}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$POCKET_WEBHOOK_SECRET" -hex | awk '{print $2}')
curl -X POST localhost:3000/api/ingest/pocket \
  -H 'content-type: application/json' -H "x-pocket-signature: sha256=$SIG" -d "$BODY"
```

De webhook schrijft de ruwe bron weg en zet een job in de wachtrij; de worker
doet de extractie. Kijk daarna op `/bronnen/<id>`.

## Evaluatie draaien

De ruwe transcripten staan bewust niet in de repo: er zit onder meer een
wervingsgesprek in met opmerkingen over kandidaten. Zet ze lokaal in
`eval/fixtures/` (gitignored), bied ze aan op de webhook, en laat de worker
draaien. Daarna:

```bash
pnpm --filter @meetinghub/worker exec node dist/verify-quotes.js
```

Dat controleert of elk citaat in de opgeslagen extracties letterlijk in de ruwe
bron staat, en geeft exitcode 1 zodra er één verzonnen is. Dat is de enige harde
eis uit `docs/eval.md` die machinaal te toetsen is.

Zonder API sleutel kun je een elders gedraaide extractie inladen langs dezelfde
validatie en opslag:

```bash
node dist/import-extraction.js <sourceId> extractie.json extract-v1 claude-opus-5
```

Uitkomsten per run staan in `docs/eval-runs.md`.

## Wat sprint 1 wel en niet doet

Wel: het volledige schema als migratie, de Pocket webhook met
handtekeningcontrole en dubbeltjesbescherming, de extractie met
`extract-v1` plus het woordenboek, en de brondetailpagina die de ruwe bron
naast de extractie zet.

Niet: koppeling naar `decisions`, `commitments` en de rest. De ruwe
extractie-JSON gaat naar de `extractions` tabel, met promptversie en model
erbij. Die projectie hoort bij sprint 2 en 3, want zonder entiteitkoppeling en
triage zou je toezeggingen vastleggen zonder eigenaar — precies wat kernprincipe
6 verbiedt. Rerunnen kan altijd: de ruwe bron blijft staan.

Geen auth, geen dashboard. De pagina op `/` is alleen een bronnenlijst om bij
een detailpagina te komen.

## Railway

Vier services in een project. **Laat de root directory op de repowortel staan,
niet op `apps/web` of `apps/worker`.** Het zijn workspace-packages: ze leunen op
de `dist` van `packages/db` en `packages/core`, en die bestaat pas als je die
eerst bouwt.

| Service | Build command | Start command | Env |
|---|---|---|---|
| `web` | `pnpm build:web` | `pnpm start:web` | `DATABASE_URL`, `POCKET_WEBHOOK_SECRET` |
| `worker` | `pnpm build:worker` | `pnpm start:worker` | `DATABASE_URL`, `ANTHROPIC_API_KEY` |
| `postgres` | — | — | extensies `vector` en `pg_trgm` aanzetten |
| cron | — | zie onder | `DATABASE_URL` |

De drie punten in `--filter "@meetinghub/worker..."` doen het werk: die bouwen
ook de workspace-afhankelijkheden, in de juiste volgorde. Zonder die punten
faalt de build op `Cannot find module '@meetinghub/core'`.

De API sleutel hoort alleen bij de worker. Die is het enige proces dat Claude
aanroept; web schrijft de bron weg en zet een job in de wachtrij.

Cron:
- `0 5 * * 1-5` ochtendbriefing
- `0 14 * * 5` vrijdagdigest
- `0 3 * * *` `select mark_stale_commitments(21)`

## Resend

Twee toepassingen:

1. **Magic link login.** Enige gebruiker. Token van 15 minuten, opgeslagen als
   hash, eenmalig bruikbaar. Sessie via httpOnly cookie van 30 dagen.
2. **Uitgaande briefings.** Ochtendbriefing en vrijdagdigest.

Domein verifieren in Resend, SPF en DKIM records zetten, en `from` op een
subdomein zoals `hub@mail.jouwdomein.nl`.

## Volgorde

Sprint 1 ingest en extractie. Sprint 2 entiteiten en triage. Sprint 3
reconciliatie en opvolging. Sprint 4 mail inbound. Sprint 5 briefings.

Ga pas door naar de volgende sprint als docs/eval.md slaagt. Die evaluatie is
nog niet gedraaid: daarvoor zijn de twee Pocket opnames van 12 en 13 augustus
nodig, en die zitten niet in de repo.
