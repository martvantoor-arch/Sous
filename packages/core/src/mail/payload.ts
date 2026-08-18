// Wat de inbound webhook van Resend levert.
//
// Let op wat er níet in staat: de body. Resend stuurt bij `email.received`
// alleen metadata en verwacht dat je de inhoud apart ophaalt, zodat een mail
// met een bijlage van tien megabyte geen webhook omver duwt. Vandaar de twee
// stappen — deze route schrijft de envelop weg, de worker haalt de brief op.
import { z } from 'zod';

const stringArray = z.preprocess(
  (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : []),
  z.array(z.string()),
);

const data = z.object({
  email_id: z.string().min(1),
  from: z.string().default(''),
  to: stringArray.default([]),
  cc: stringArray.default([]),
  bcc: stringArray.default([]),
  /** het adres waarop de mail bij ons binnenkwam; bij plusadressering het label */
  received_for: stringArray.default([]),
  message_id: z.string().nullish(),
  subject: z.string().nullish(),
  created_at: z.string().nullish(),
  attachments: z
    .array(
      z.object({
        id: z.string().optional(),
        filename: z.string().optional(),
        content_type: z.string().optional(),
      }),
    )
    .default([]),
});

export const inboundMailSchema = z.object({
  type: z.string(),
  created_at: z.string().nullish(),
  data,
});

export type InboundMail = z.infer<typeof inboundMailSchema>;

/**
 * Het enige type dat we verwerken. Resend stuurt over hetzelfde eindpunt ook
 * bezorgstatussen van uitgaande mail — die van de inloglinks — en die horen
 * hier niet als bron te belanden.
 */
export const ONTVANGEN = 'email.received';
