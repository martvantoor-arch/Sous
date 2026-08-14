-- MeetingHub schema, Postgres 16 + pgvector
create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- entiteiten

create table people (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  role          text,
  organisation  text,                      -- Foodconnect, Albert Heijn, leverancier
  is_internal   boolean not null default true,
  aliases       text[] not null default '{}',  -- ASR verhaspelingen en roepnamen
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table projects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  code          text unique,
  status        text not null default 'actief',   -- actief | gepauzeerd | afgerond
  owner_id      uuid references people(id),
  aliases       text[] not null default '{}',
  description   text,
  started_on    date,
  created_at    timestamptz not null default now()
);

-- vaktermenwoordenboek: het belangrijkste kwaliteitsinstrument
create table terms (
  id            uuid primary key default gen_random_uuid(),
  term          text not null,             -- correcte schrijfwijze
  expansion     text,                      -- voluit
  domain        text,                      -- kwaliteit | product | proces | organisatie
  variants      text[] not null default '{}',  -- hoe de ASR het verhaspelt
  note          text
);

-- ------------------------------------------------------------------- bronnen

create table sources (
  id              uuid primary key default gen_random_uuid(),
  type            text not null,           -- meeting | mail | notitie | document
  external_id     text unique,             -- pocket recording id, message id
  title           text,
  occurred_at     timestamptz not null,
  duration_sec    integer,
  raw_text        text not null,           -- transcript of mailbody
  summary_text    text,                    -- Pocket samenvatting: primaire bron
  provider_actions jsonb,                  -- Pocket action items, als signaal
  project_id      uuid references projects(id),
  project_conf    numeric(3,2),
  sensitive       boolean not null default false,
  sensitive_reason text,
  processed_at    timestamptz,
  prompt_version  text,
  model           text,
  created_at      timestamptz not null default now()
);

create table source_chunks (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references sources(id) on delete cascade,
  ord         integer not null,
  text        text not null,
  sensitive   boolean not null default false,
  embedding   vector(1024)
);
create index on source_chunks using ivfflat (embedding vector_cosine_ops);

create table source_participants (
  source_id   uuid references sources(id) on delete cascade,
  person_id   uuid references people(id),
  confidence  numeric(3,2),
  primary key (source_id, person_id)
);

-- ---------------------------------------------------------------- extracties

create table decisions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id),
  source_id    uuid not null references sources(id),
  what         text not null,
  decided_by   uuid references people(id),
  decided_on   date,
  context      text,
  quote        text,
  confidence   numeric(3,2),
  created_at   timestamptz not null default now()
);

create table commitments (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references projects(id),
  what             text not null,
  owner_id         uuid references people(id),
  owner_raw        text,                   -- wat er letterlijk stond
  promised_to_id   uuid references people(id),
  deadline         date,
  deadline_raw     text,                   -- "volgende week woensdag"
  status           text not null default 'open',
      -- open | bijgewerkt | afgerond | vervallen | stil
  status_source    text not null default 'meeting',
      -- meeting | mail | gesprek | regel
  status_conf      numeric(3,2),
  first_seen_source uuid references sources(id),
  last_seen_source  uuid references sources(id),
  last_seen_at     timestamptz,
  closed_at        timestamptz,
  closed_quote     text,
  created_at       timestamptz not null default now()
);
create index on commitments (project_id, status);
create index on commitments (deadline) where status = 'open';

create table open_questions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id),
  source_id    uuid not null references sources(id),
  question     text not null,
  owner_id     uuid references people(id),
  status       text not null default 'open',
  answer       text,
  answered_source uuid references sources(id),
  created_at   timestamptz not null default now()
);

create table risks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id),
  source_id    uuid not null references sources(id),
  description  text not null,
  severity     text,                       -- laag | midden | hoog
  status       text not null default 'open',
  created_at   timestamptz not null default now()
);

create table metrics (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id),
  source_id    uuid not null references sources(id),
  name         text not null,
  value        numeric,
  unit         text,
  as_of        date,
  quote        text
);

create table notes (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,              -- commitment | decision | project
  entity_id    uuid not null,
  kind         text not null,              -- afronding | update | context | correctie
  text         text not null,
  source_id    uuid references sources(id),
  quote        text,
  created_at   timestamptz not null default now()
);
create index on notes (entity_type, entity_id);

-- -------------------------------------------------------- triage en historie

create table triage_queue (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references sources(id),
  kind         text not null,   -- nieuwe_toezegging | afronding | project_onbekend
                                -- persoon_onbekend | nieuwe_term | conflict
  proposal     jsonb not null,
  question     text not null,   -- de vraag die de assistent stelt
  confidence   numeric(3,2),
  status       text not null default 'open',  -- open | akkoord | afgewezen
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on triage_queue (status, created_at);

create table change_log (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  field        text not null,
  old_value    text,
  new_value    text,
  source_id    uuid references sources(id),
  origin       text not null,   -- extractie | reconciliatie | gesprek | regel
  quote        text,
  created_at   timestamptz not null default now()
);
create index on change_log (entity_type, entity_id, created_at desc);

-- correcties van Marten: de verbetermotor
create table corrections (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text,
  entity_id    uuid,
  ai_did       text not null,
  marten_said  text not null,
  category     text,            -- eigenaar | status | project | term | verzonnen
  created_at   timestamptz not null default now()
);

create table project_briefs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id),
  markdown      text not null,
  changes_since text,
  based_on      uuid[] not null default '{}',
  generated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------- regels

-- toezeggingen die te lang stil zijn markeren, draait als cron
create or replace function mark_stale_commitments(days integer default 21)
returns integer language sql as $$
  with upd as (
    update commitments
       set status = 'stil'
     where status = 'open'
       and last_seen_at < now() - (days || ' days')::interval
    returning 1
  ) select count(*)::int from upd;
$$;
