'use server';

// Server actions voor de triage wachtrij. Dit is de enige plek in de UI waar
// iets aangemaakt wordt, en dat is expres: het systeem doet voorstellen, Marten
// keurt goed.
import { revalidatePath } from 'next/cache';
import { resolveTriage, type TriageBesluit } from '@meetinghub/core';

export async function beslisOverTriage(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const besluit = String(formData.get('besluit') ?? '') as TriageBesluit;

  if (!id) throw new Error('geen triage-id meegegeven');
  if (besluit !== 'akkoord' && besluit !== 'afgewezen') {
    throw new Error(`onbekend besluit: ${besluit}`);
  }

  await resolveTriage(id, besluit);

  revalidatePath('/triage');
  revalidatePath('/personen');
  revalidatePath('/projecten');
  revalidatePath('/termen');
}
