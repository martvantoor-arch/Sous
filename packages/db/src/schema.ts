// Drizzle-spiegel van db/schema.sql. Kolomnamen Engels, zoals afgesproken.
// Migraties nooit met de hand: pas dit bestand aan en draai `pnpm db:generate`.
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Zekerheid tussen 0 en 1. Overal dezelfde precisie, zodat drempels vergelijkbaar blijven. */
const confidence = (name: string) => numeric(name, { precision: 3, scale: 2 });

// ---------------------------------------------------------------- entiteiten

export const people = pgTable('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  role: text('role'),
  /** Foodconnect, Albert Heijn, leverancier */
  organisation: text('organisation'),
  /**
   * Mailadres, zodat een doorgestuurde mail aan een persoon te hangen is.
   *
   * Uniek, want twee rijen met hetzelfde adres betekent dat er iemand dubbel
   * in de lijst staat en dat de ene helft van zijn toezeggingen bij de andere
   * helft verdwijnt. Leeg mag: van de meeste mensen in een meeting weten we
   * het adres niet, en dat hoeft ook niet.
   */
  email: text('email').unique(),
  isInternal: boolean('is_internal').notNull().default(true),
  /** ASR verhaspelingen en roepnamen */
  aliases: text('aliases').array().notNull().default(sql`'{}'`),
  /**
   * Aan wie deze persoon rapporteert. Zelfverwijzend, dus het organogram is
   * gewoon deze kolom uitgelezen als boom.
   *
   * Niet alleen voor het plaatje: wie aan wie rapporteert is context die helpt
   * bij het afleiden van eigenaarschap. "Dat pakt mijn team op" is pas te
   * herleiden als bekend is wie er in dat team zit.
   */
  managerId: uuid('manager_id').references((): AnyPgColumn => people.id),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code').unique(),
  /** actief | gepauzeerd | afgerond */
  status: text('status').notNull().default('actief'),
  ownerId: uuid('owner_id').references(() => people.id),
  aliases: text('aliases').array().notNull().default(sql`'{}'`),
  description: text('description'),
  startedOn: date('started_on'),
  createdAt: createdAt(),
});

/** Vaktermenwoordenboek: het belangrijkste kwaliteitsinstrument. */
export const terms = pgTable('terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** correcte schrijfwijze */
  term: text('term').notNull(),
  expansion: text('expansion'),
  /** kwaliteit | product | proces | organisatie */
  domain: text('domain'),
  /** hoe de ASR het verhaspelt */
  variants: text('variants').array().notNull().default(sql`'{}'`),
  note: text('note'),
});

// -------------------------------------------------------------------- login

/**
 * Eenmalige inloglinks. We bewaren nooit de link zelf maar alleen een hash
 * ervan: wie de database leest kan er dan geen geldige link uit terugbouwen.
 *
 * Een token is één keer bruikbaar (`usedAt`) en verloopt (`expiresAt`). Beide
 * zijn nodig: zonder eenmaligheid blijft een link uit een oude mailbox werken,
 * zonder verlooptijd blijft een nooit gebruikte link eeuwig geldig.
 */
export const loginTokens = pgTable(
  'login_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('login_tokens_email_idx').on(t.email, t.createdAt)],
);

/**
 * Actieve sessies. Ook hier alleen de hash van het cookie, om dezelfde reden.
 * Een rij verwijderen is uitloggen; alle rijen verwijderen is iedereen uitloggen,
 * en dat is precies wat je wilt kunnen als er ooit iets uitlekt.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('auth_sessions_email_idx').on(t.email, t.createdAt)],
);

// ------------------------------------------------------------------- bronnen

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** meeting | mail | notitie | document */
  type: text('type').notNull(),
  /** pocket recording id, message id */
  externalId: text('external_id').unique(),
  title: text('title'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  durationSec: integer('duration_sec'),
  /**
   * Transcript of mailbody, onaangetast — tot de bewaartermijn verloopt.
   *
   * Leeg betekent één van twee dingen, en `rawPurgedAt` zegt welke: de bron
   * kwam zonder tekst binnen, of de ruwe tekst is opgeruimd en alleen de
   * gestructureerde extractie is over. Zie `retention.ts`.
   */
  rawText: text('raw_text'),
  /** Pocket samenvatting: primaire bron voor de extractie */
  summaryText: text('summary_text'),
  /** Gezet zodra de ruwe tekst is opgeruimd. Null zolang die er nog is. */
  rawPurgedAt: timestamp('raw_purged_at', { withTimezone: true }),
  /** Pocket action items, als signaal */
  providerActions: jsonb('provider_actions'),
  projectId: uuid('project_id').references(() => projects.id),
  projectConf: confidence('project_conf'),
  sensitive: boolean('sensitive').notNull().default(false),
  sensitiveReason: text('sensitive_reason'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  promptVersion: text('prompt_version'),
  model: text('model'),
  createdAt: createdAt(),
});

/**
 * Wat alleen een mail heeft.
 *
 * De bron zelf blijft één rij in `sources` met type `mail` — kernprincipe 2,
 * één tabel en één pijplijn. Maar afzender, geadresseerden en het
 * berichtnummer zijn niets voor een meeting, en tien lege kolommen op elke
 * opname is geen datamodel maar een restant. Vandaar hiernaast, met dezelfde
 * id.
 *
 * `bodyHtml` staat er los naast `sources.raw_text`: Resend levert een mail
 * vaak in twee vormen, en welke van de twee de tekst is die Marten verstuurde
 * hoort niet in een gok te eindigen. `raw_text` krijgt de platte versie als
 * die er is; de html blijft hier onaangetast staan.
 */
export const sourceMail = pgTable(
  'source_mail',
  {
    sourceId: uuid('source_id')
      .primaryKey()
      .references(() => sources.id, { onDelete: 'cascade' }),
    /** letterlijk uit de header, inclusief weergavenaam */
    fromRaw: text('from_raw').notNull(),
    /** gekoppeld zodra we het adres herkennen; anders leeg en dus een triagevraag */
    fromPersonId: uuid('from_person_id').references(() => people.id),
    toRaw: text('to_raw').array().notNull().default(sql`'{}'`),
    ccRaw: text('cc_raw').array().notNull().default(sql`'{}'`),
    /**
     * Het stuk achter de `+` in het ontvangende adres. `marten+blk@…` levert
     * `blk`. Dit is het enige stukje routering dat Marten zelf typt en dus het
     * sterkste signaal dat we over een bron hebben — sterker dan wat een model
     * uit de inhoud afleidt.
     */
    routingTag: text('routing_tag'),
    /** RFC Message-ID. Blijft gelijk als dezelfde mail twee keer binnenkomt. */
    messageId: text('message_id'),
    inReplyTo: text('in_reply_to'),
    references: text('references').array().notNull().default(sql`'{}'`),
    bodyHtml: text('body_html'),
    headers: jsonb('headers'),
  },
  (t) => [index('source_mail_routing_tag_idx').on(t.routingTag)],
);

export const sourceChunks = pgTable('source_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  ord: integer('ord').notNull(),
  text: text('text').notNull(),
  sensitive: boolean('sensitive').notNull().default(false),
  embedding: vector('embedding', { dimensions: 1024 }),
});

/**
 * Een meeting raakt vaak meer dan één project. De 13 augustus opname gaat over
 * BLK implementatie én Digitalisering ingangscontrole; die punten horen elk bij
 * hun eigen project. `sources.project_id` blijft het hoofdproject, handig als
 * label; deze tabel houdt alles bij wat de bron raakt, hoofdproject incluis.
 */
export const sourceProjects = pgTable(
  'source_projects',
  {
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    confidence: confidence('confidence'),
    /** hoofdproject van de bron, of een van de andere aangeraakte projecten */
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.projectId] })],
);

export const sourceParticipants = pgTable(
  'source_participants',
  {
    sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }),
    personId: uuid('person_id').references(() => people.id),
    confidence: confidence('confidence'),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.personId] })],
);

// ---------------------------------------------------------------- extracties

export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id),
  what: text('what').notNull(),
  decidedBy: uuid('decided_by').references(() => people.id),
  decidedOn: date('decided_on'),
  context: text('context'),
  quote: text('quote'),
  confidence: confidence('confidence'),
  createdAt: createdAt(),
});

export const commitments = pgTable(
  'commitments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id),
    what: text('what').notNull(),
    ownerId: uuid('owner_id').references(() => people.id),
    /** wat er letterlijk stond */
    ownerRaw: text('owner_raw'),
    promisedToId: uuid('promised_to_id').references(() => people.id),
    deadline: date('deadline'),
    /** "volgende week woensdag" */
    deadlineRaw: text('deadline_raw'),
    /** open | bijgewerkt | afgerond | vervallen | stil */
    status: text('status').notNull().default('open'),
    /** meeting | mail | gesprek | regel */
    statusSource: text('status_source').notNull().default('meeting'),
    statusConf: confidence('status_conf'),
    firstSeenSource: uuid('first_seen_source').references(() => sources.id),
    lastSeenSource: uuid('last_seen_source').references(() => sources.id),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedQuote: text('closed_quote'),
    createdAt: createdAt(),
  },
  (t) => [
    index('commitments_project_status_idx').on(t.projectId, t.status),
    index('commitments_deadline_open_idx')
      .on(t.deadline)
      .where(sql`status = 'open'`),
  ],
);

export const openQuestions = pgTable('open_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id),
  question: text('question').notNull(),
  ownerId: uuid('owner_id').references(() => people.id),
  status: text('status').notNull().default('open'),
  answer: text('answer'),
  answeredSource: uuid('answered_source').references(() => sources.id),
  createdAt: createdAt(),
});

export const risks = pgTable('risks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id),
  description: text('description').notNull(),
  /** laag | midden | hoog */
  severity: text('severity'),
  status: text('status').notNull().default('open'),
  createdAt: createdAt(),
});

export const metrics = pgTable('metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => sources.id),
  name: text('name').notNull(),
  value: numeric('value'),
  unit: text('unit'),
  asOf: date('as_of'),
  quote: text('quote'),
});

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** commitment | decision | project */
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    /** afronding | update | context | correctie */
    kind: text('kind').notNull(),
    text: text('text').notNull(),
    sourceId: uuid('source_id').references(() => sources.id),
    quote: text('quote'),
    createdAt: createdAt(),
  },
  (t) => [index('notes_entity_idx').on(t.entityType, t.entityId)],
);

// -------------------------------------------------------- triage en historie

export const triageQueue = pgTable(
  'triage_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').references(() => sources.id),
    /**
     * nieuwe_toezegging | afronding | project_onbekend | persoon_onbekend
     * | nieuwe_term | conflict
     */
    kind: text('kind').notNull(),
    proposal: jsonb('proposal').notNull(),
    /** de vraag die de assistent stelt */
    question: text('question').notNull(),
    confidence: confidence('confidence'),
    /** open | akkoord | afgewezen */
    status: text('status').notNull().default('open'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('triage_queue_status_created_idx').on(t.status, t.createdAt)],
);

export const changeLog = pgTable(
  'change_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    field: text('field').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    sourceId: uuid('source_id').references(() => sources.id),
    /** extractie | reconciliatie | gesprek | regel */
    origin: text('origin').notNull(),
    quote: text('quote'),
    createdAt: createdAt(),
  },
  (t) => [
    index('change_log_entity_idx').on(t.entityType, t.entityId, t.createdAt.desc()),
  ],
);

/** Correcties van Marten: de verbetermotor. */
export const corrections = pgTable('corrections', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  aiDid: text('ai_did').notNull(),
  martenSaid: text('marten_said').notNull(),
  /** eigenaar | status | project | term | verzonnen */
  category: text('category'),
  createdAt: createdAt(),
});

export const projectBriefs = pgTable('project_briefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  markdown: text('markdown').notNull(),
  changesSince: text('changes_since'),
  basedOn: uuid('based_on').array().notNull().default(sql`'{}'`),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ------------------------------------------------------------ ruwe extractie

/**
 * De onbewerkte JSON die het model teruggaf, met promptversie en model erbij.
 * Extracties zijn wegwerpbaar: dit is wat je opnieuw kunt draaien als de prompt
 * beter wordt, en waartegen je een nieuwe promptversie afzet. De projectie naar
 * decisions, commitments en de rest gebeurt in een latere sprint, met
 * entiteitkoppeling en reconciliatie ertussen.
 */
export const extractions = pgTable(
  'extractions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    promptVersion: text('prompt_version').notNull(),
    model: text('model').notNull(),
    result: jsonb('result').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('extractions_source_idx').on(t.sourceId, t.createdAt.desc())],
);

// -------------------------------------------------------------------- kosten

/**
 * Niet in db/schema.sql, wel verplicht volgens CLAUDE.md: elke Claude call logt
 * promptversie, model, tokens, duur en kosten. Zonder tabel kun je een
 * promptwijziging niet afzetten tegen wat hij kost.
 */
export const llmCalls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }),
    /** extractie | reconciliatie */
    kind: text('kind').notNull(),
    promptVersion: text('prompt_version').notNull(),
    /**
     * Sha256 over de systeemprompt, eerste twaalf tekens. De versienaam zegt
     * welk bestand er gebruikt is, niet welke inhoud dat bestand had. Tussen
     * een push en een deploy zit tijd, en een prompt die je bijwerkt vóór zijn
     * eerste meting houdt zijn naam. Zonder deze kolom kun je achteraf niet
     * vaststellen welke tekst een run gedraaid heeft; met deze kolom zie je
     * twee runs met dezelfde naam en een andere vingerafdruk meteen.
     */
    promptFingerprint: text('prompt_fingerprint'),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    durationMs: integer('duration_ms').notNull(),
    /** in dollarcent, zodat afronding niet stilletjes verdwijnt */
    costUsdCents: numeric('cost_usd_cents', { precision: 12, scale: 4 }),
    stopReason: text('stop_reason'),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [index('llm_calls_source_idx').on(t.sourceId, t.createdAt.desc())],
);
