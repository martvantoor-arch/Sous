'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isToegestaan, maakLoginToken, logUit } from '@/lib/auth';
import { stuurLoginLink } from '@/lib/mail';

/**
 * Vraagt een inloglink aan.
 *
 * Het antwoord is altijd hetzelfde, of het adres nu mag inloggen of niet. Een
 * verschillend antwoord zou verklappen welke adressen toegang hebben, en dat is
 * precies wat je een aanvaller niet wilt vertellen.
 */
export async function vraagLoginLink(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (email && isToegestaan(email)) {
    const token = await maakLoginToken(email);
    const basis =
      process.env.APP_URL?.replace(/\/$/, '') ??
      `https://${(await headers()).get('host') ?? 'localhost:3000'}`;
    try {
      await stuurLoginLink(email, `${basis}/login/verifieer?token=${token}`);
    } catch {
      redirect('/login?status=fout');
    }
  }

  redirect('/login?status=verstuurd');
}

export async function meldAf(): Promise<void> {
  await logUit();
  redirect('/login?status=afgemeld');
}
