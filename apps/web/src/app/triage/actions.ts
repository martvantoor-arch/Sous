'use server';

// Server actions voor de triage wachtrij. Dit is de enige plek in de UI waar
// iets aangemaakt wordt, en dat is expres: het systeem doet voorstellen, Marten
// keurt goed.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { resolveTriage, splitsLijst, type TriageBesluit } from '@meetinghub/core';

/**
 * De velden die je vóór aanmaken mag corrigeren. Het voorstel van het model is
 * een gok: een verhaspelde naam die je hier laat staan komt in elke koppeling
 * en in elke volgende prompt terecht.
 *
 * Leeg gelaten velden vallen terug op wat het model voorstelde, zodat een
 * gedeeltelijke correctie de rest niet wist.
 */
const CORRIGEERBAAR = [
  'naam',
  'rol',
  'organisatie',
  'varianten',
  'vermoedelijke_term',
  'betekenis',
] as const;

export async function beslisOverTriage(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const besluit = String(formData.get('besluit') ?? '') as TriageBesluit;

  if (!id) throw new Error('geen triage-id meegegeven');
  if (besluit !== 'akkoord' && besluit !== 'afgewezen') {
    throw new Error(`onbekend besluit: ${besluit}`);
  }

  const correctie: Record<string, unknown> = {};
  for (const veld of CORRIGEERBAAR) {
    const waarde = formData.get(veld);
    if (typeof waarde !== 'string' || !waarde.trim()) continue;
    correctie[veld] = veld === 'varianten' ? splitsLijst(waarde) : waarde.trim();
  }
  const isIntern = formData.get('isIntern');
  if (typeof isIntern === 'string' && isIntern) correctie.is_intern = isIntern === 'ja';

  let melding: string | null = null;
  try {
    await resolveTriage(id, besluit, { correctie });
  } catch (err) {
    melding = err instanceof Error ? err.message : 'onbekende fout';
  }

  revalidatePath('/triage');
  revalidatePath('/personen');
  revalidatePath('/organogram');
  revalidatePath('/projecten');
  revalidatePath('/termen');
  redirect(melding ? `/triage?melding=${encodeURIComponent(melding)}` : '/triage');
}
