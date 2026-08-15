// Zod-spiegel van het outputblok in prompts/extract-v2.md. Het promptbestand is
// het contract; dit is de bewaking erop. Wijkt de output af, dan valt de job om
// met een leesbare fout in plaats van half vastgelegde onzin.
//
// Het schema leest ook v1-output. Extracties zijn wegwerpbaar, maar de
// opgeslagen JSON van eerdere runs moet leesbaar blijven zonder migratie.
import { z } from 'zod';

const uuidOrNull = z.string().uuid().nullable().catch(null);
const confidence = z.number().min(0).max(1);
/** Het model levert 'YYYY-MM-DD' of null. Rommel wordt null, niet een gokdatum. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .catch(null);

/** Project waar een los punt bij hoort. v1 kende dit veld niet. */
const itemProject = uuidOrNull.default(null);

const projectRef = z.object({
  id: uuidOrNull,
  naam_raw: z.string().default(''),
  confidence: confidence.default(0),
});

const body = z.object({
  projecten: z.array(projectRef).default([]),
  besluiten: z
    .array(
      z.object({
        wat: z.string(),
        project: itemProject,
        wie: uuidOrNull,
        wanneer: isoDate,
        context: z.string().default(''),
        citaat: z.string().default(''),
        confidence: confidence,
      }),
    )
    .default([]),
  toezeggingen: z
    .array(
      z.object({
        wat: z.string(),
        project: itemProject,
        owner: uuidOrNull,
        owner_raw: z.string().default(''),
        aan_wie: uuidOrNull,
        deadline: isoDate,
        deadline_raw: z.string().default(''),
        citaat: z.string().default(''),
        confidence: confidence,
      }),
    )
    .default([]),
  afrondingen: z
    .array(
      z.object({
        beschrijving_bestaand_punt: z.string(),
        project: itemProject,
        bewijs_citaat: z.string().default(''),
        type: z.enum(['expliciet', 'beweging']),
        confidence: confidence,
      }),
    )
    .default([]),
  open_vragen: z
    .array(
      z.object({
        vraag: z.string(),
        project: itemProject,
        owner: uuidOrNull,
        citaat: z.string().default(''),
        confidence: confidence,
      }),
    )
    .default([]),
  risicos: z
    .array(
      z.object({
        omschrijving: z.string(),
        project: itemProject,
        ernst: z.enum(['laag', 'midden', 'hoog']).nullable().catch(null),
        citaat: z.string().default(''),
      }),
    )
    .default([]),
  cijfers: z
    .array(
      z.object({
        naam: z.string(),
        project: itemProject,
        waarde: z.number().nullable().catch(null),
        eenheid: z.string().default(''),
        datum: isoDate,
        citaat: z.string().default(''),
      }),
    )
    .default([]),
  nieuwe_termen: z
    .array(
      z.object({
        vermoedelijke_term: z.string(),
        varianten: z.array(z.string()).default([]),
        context: z.string().default(''),
      }),
    )
    .default([]),
  /** Voorstellen, geen aanmaak. Marten keurt ze goed via de triage wachtrij. */
  nieuwe_personen: z
    .array(
      z.object({
        naam: z.string(),
        rol: z.string().default(''),
        organisatie: z.string().default(''),
        is_intern: z.boolean().nullable().catch(null),
        varianten: z.array(z.string()).default([]),
        context: z.string().default(''),
        citaat: z.string().default(''),
        confidence: confidence.default(0.5),
      }),
    )
    .default([]),
  gevoelig: z
    .array(z.object({ onderwerp: z.string(), reden: z.string().default('') }))
    .default([]),
  triage: z
    .array(
      z.object({
        kind: z.string(),
        voorstel: z.record(z.unknown()).default({}),
        vraag: z.string(),
        confidence: confidence,
      }),
    )
    .default([]),
});

/** v1 leverde één `project` object; v2 levert een lijst `projecten`. */
function normaliseVersions(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  if ('projecten' in obj || !('project' in obj)) return obj;

  const { project, ...rest } = obj;
  const single = project as { id?: string | null } | null;
  return { ...rest, projecten: single?.id ? [single] : [] };
}

export const extractionSchema = z.preprocess(normaliseVersions, body);

export type Extraction = z.infer<typeof body>;

/**
 * Het model hoort kale JSON te leveren. Mocht er toch een fence omheen zitten,
 * dan halen we die eraf in plaats van de hele meeting weg te gooien.
 */
export function parseExtraction(text: string): Extraction {
  let payload = text.trim();
  if (payload.startsWith('```')) {
    payload = payload.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return extractionSchema.parse(JSON.parse(payload));
}
