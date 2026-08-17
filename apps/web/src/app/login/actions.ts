'use server';

import { redirect } from 'next/navigation';
import { isToegestaan, maakLoginToken, logUit } from '@/lib/auth';
import { stuurLoginLink } from '@/lib/mail';
import { basisUrl } from '@/lib/url';

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
    const basis = await basisUrl();
    if (!basis) {
      // Liever geen mail dan een link die nergens heen gaat. Een onbruikbare
      // link in een mailbox ziet eruit alsof het werkte.
      console.error('[login] geen basis-URL te bepalen; zet APP_URL');
      redirect('/login?status=fout');
    }

    const token = await maakLoginToken(email);
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
