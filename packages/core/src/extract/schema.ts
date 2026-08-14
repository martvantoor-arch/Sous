// Zod-spiegel van het outputblok in prompts/extract-v1.md. Het promptbestand is
// het contract; dit is de bewaking erop. Wijkt de output af, dan valt de job om
// met een leesbare fout in plaats van half vastgelegde onzin.
import { z } from 'zod';

const uuidOrNull = z.string().uuid().nullable().catch(null);
const confidence = z.number().min(0).max(1);
/** Het model levert 'YYYY-MM-DD' of null. Rommel wordt null, niet een gokdatum. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .catch(null);

export const extractionSchema = z.object({
  project: z.object({
    id: uuidOrNull,
    naam_raw: z.string().default(''),
    confidence: confidence.default(0),
  }),
  besluiten: z
    .array(
      z.object({
        wat: z.string(),
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
        ernst: z.enum(['laag', 'midden', 'hoog']).nullable().catch(null),
        citaat: z.string().default(''),
      }),
    )
    .default([]),
  cijfers: z
    .array(
      z.object({
        naam: z.string(),
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

export type Extraction = z.infer<typeof extractionSchema>;

/**
 * Het model hoort kale JSON te leveren. Mocht er toch een fence omheen zitten,
 * dan halen we die eraf in plaats van de hele meeting weg te gooien.
 */
export function parseExtraction(text: string): Extraction {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return extractionSchema.parse(JSON.parse(body));
}
