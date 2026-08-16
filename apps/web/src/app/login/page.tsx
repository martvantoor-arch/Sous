// Inlogscherm. Eén veld, want er is één manier om binnen te komen.
import { vraagLoginLink } from './actions';

export const dynamic = 'force-dynamic';

const MELDING: Record<string, string> = {
  verstuurd:
    'Als dit adres toegang heeft, staat er nu een inloglink in de mailbox. De link werkt vijftien minuten en één keer.',
  fout: 'De mail kon niet verstuurd worden. Probeer het nog eens.',
  afgemeld: 'Je bent afgemeld.',
  ongeldig: 'Die link werkt niet meer. Vraag een nieuwe aan.',
};

export default async function LoginPagina({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">MeetingHub</h1>
        <p className="text-sm text-stone-500">
          Vul je e-mailadres in, dan sturen we een inloglink.
        </p>
      </header>

      {status && MELDING[status] && (
        <p className="rounded border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900">
          {MELDING[status]}
        </p>
      )}

      <form action={vraagLoginLink} className="space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
            E-mailadres
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            autoFocus
            className="rounded border border-stone-300 bg-white px-2 py-1 dark:border-stone-700 dark:bg-stone-950"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Stuur de link
        </button>
      </form>
    </div>
  );
}
