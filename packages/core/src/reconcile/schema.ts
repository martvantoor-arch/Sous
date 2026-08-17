// Het contract voor de reconciliatiepass. Wat het model teruggeeft moet hier
// doorheen; wat er niet doorheen komt, komt de database niet in.
import { z } from 'zod';

export const uitkomsten = ['nieuw', 'zelfde', 'bijgewerkt', 'afgerond', 'vervallen'] as const;
export type Uitkomst = (typeof uitkomsten)[number];

const leegNaarNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema);

export const koppelingSchema = z.object({
  nieuw_index: z.number().int().nonnegative(),
  uitkomst: z.enum(uitkomsten),
  bestaand_id: leegNaarNull(z.string().uuid().nullable()).default(null),
  wijziging: leegNaarNull(z.string().nullable()).default(null),
  citaat: leegNaarNull(z.string().nullable()).default(null),
  vraag: leegNaarNull(z.string().nullable()).default(null),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const reconciliatieSchema = z.object({
  koppelingen: z.array(koppelingSchema).default([]),
});

export type Koppeling = z.infer<typeof koppelingSchema>;
export type Reconciliatie = z.infer<typeof reconciliatieSchema>;

/**
 * Een uitkomst die naar een bestaande toezegging verwijst zonder id is
 * onbruikbaar. In plaats van de hele pass te laten omvallen degraderen we hem
 * naar `nieuw`: een dubbele toezegging is te herstellen, een verdwenen niet.
 */
export function parseReconciliatie(tekst: string): Reconciliatie {
  const schoon = tekst
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  const ruw = reconciliatieSchema.parse(JSON.parse(schoon));

  return {
    koppelingen: ruw.koppelingen.map((k) =>
      k.uitkomst !== 'nieuw' && !k.bestaand_id
        ? {
            ...k,
            uitkomst: 'nieuw' as const,
            vraag:
              k.vraag ??
              `Het model koos "${k.uitkomst}" maar gaf geen bestaande toezegging mee; als nieuw opgenomen.`,
          }
        : k,
    ),
  };
}
