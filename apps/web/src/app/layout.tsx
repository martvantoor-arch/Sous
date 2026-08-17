import type { Metadata } from 'next';
import Link from 'next/link';
import { huidigeGebruiker } from '@/lib/auth';
import { meldAf } from './login/actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'MeetingHub',
  description: 'Projectgeheugen',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Dit is de echte controle. De middleware kijkt alleen of er een cookie is;
  // hier wordt hij tegen de database gehouden. Zonder gebruiker tonen we geen
  // navigatie, zodat het inlogscherm ook geen menu laat zien.
  const gebruiker = await huidigeGebruiker();

  return (
    <html lang="nl">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
        <header className="border-b border-stone-200 dark:border-stone-800">
          <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-6 gap-y-2 px-6 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              MeetingHub
            </Link>
            {gebruiker && (
            <nav className="flex gap-4 text-sm text-stone-600 dark:text-stone-400">
              <Link href="/" className="hover:text-stone-900 dark:hover:text-stone-100">
                Bronnen
              </Link>
              <Link href="/opvolging" className="hover:text-stone-900 dark:hover:text-stone-100">
                Opvolging
              </Link>
              <Link href="/triage" className="hover:text-stone-900 dark:hover:text-stone-100">
                Triage
              </Link>
              <Link href="/projecten" className="hover:text-stone-900 dark:hover:text-stone-100">
                Projecten
              </Link>
              <Link href="/personen" className="hover:text-stone-900 dark:hover:text-stone-100">
                Personen
              </Link>
              <Link href="/organogram" className="hover:text-stone-900 dark:hover:text-stone-100">
                Organogram
              </Link>
              <Link href="/termen" className="hover:text-stone-900 dark:hover:text-stone-100">
                Termen
              </Link>
            </nav>
            )}
            {gebruiker && (
              <form action={meldAf} className="ml-auto">
                <button
                  type="submit"
                  className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                  title={gebruiker}
                >
                  Afmelden
                </button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
