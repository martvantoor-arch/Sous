'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  maakPersoon,
  wijzigPersoon,
  zetPersoonActief,
  verwijderPersoon,
  splitsLijst,
  type PersoonInvoer,
} from '@meetinghub/core';

/**
 * Voert een mutatie uit en stuurt terug naar de lijst.
 *
 * Een geweigerde actie mag geen crashpagina opleveren: "hij hangt nog aan negen
 * punten" is informatie die je naast de knop wilt zien, geen stacktrace. De
 * melding gaat mee in de URL zodat de pagina hem kan tonen.
 */
async function voerUit(werk: () => Promise<unknown>): Promise<never> {
  let melding: string | null = null;
  try {
    await werk();
  } catch (err) {
    melding = err instanceof Error ? err.message : 'onbekende fout';
  }
  revalidatePath('/personen');
  revalidatePath('/organogram');
  redirect(melding ? `/personen?melding=${encodeURIComponent(melding)}` : '/personen');
}

function leesInvoer(formData: FormData): PersoonInvoer {
  return {
    naam: String(formData.get('naam') ?? ''),
    rol: String(formData.get('rol') ?? ''),
    organisatie: String(formData.get('organisatie') ?? ''),
    isIntern: formData.get('isIntern') === 'ja',
    aliassen: splitsLijst(String(formData.get('aliassen') ?? '')),
    managerId: String(formData.get('managerId') ?? '') || null,
  };
}

export async function voegPersoonToe(formData: FormData): Promise<void> {
  await voerUit(() => maakPersoon(leesInvoer(formData)));
}

export async function bewerkPersoon(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await voerUit(() => wijzigPersoon(id, leesInvoer(formData)));
}

export async function wisselActief(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const actief = formData.get('actief') === 'ja';
  await voerUit(() => zetPersoonActief(id, actief));
}

export async function schrapPersoon(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await voerUit(() => verwijderPersoon(id));
}
