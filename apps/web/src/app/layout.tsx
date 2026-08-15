import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'MeetingHub',
  description: 'Projectgeheugen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
        <header className="border-b border-stone-200 dark:border-stone-800">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              MeetingHub
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
