// Formuliervelden voor een persoon. Eén component voor toevoegen en wijzigen,
// zodat de velden nooit uit elkaar lopen — en zodat de aliassen op beide
// plekken even zichtbaar zijn. Die aliassen zijn geen bijzaak: ze gaan bij elke
// extractie mee in de prompt, en zonder "de Tina" wordt Bettina niet herkend.
export function PersoonVelden({
  persoon,
  mogelijkeManagers = [],
}: {
  persoon?: {
    id?: string;
    name: string;
    role: string | null;
    organisation: string | null;
    isInternal: boolean;
    aliases: string[];
    email?: string | null;
    managerId?: string | null;
  };
  /** Iedereen behalve deze persoon zelf; een cyclus wordt server-side geweigerd. */
  mogelijkeManagers?: { id: string; name: string; role: string | null }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Veld label="Naam" naam="naam" waarde={persoon?.name} verplicht />
      <Veld label="Rol" naam="rol" waarde={persoon?.role ?? ''} plaatshouder="Category Manager" />
      <Veld
        label="Organisatie"
        naam="organisatie"
        waarde={persoon?.organisation ?? ''}
        plaatshouder="Foodconnect"
      />
      <Veld
        label="Mailadres"
        naam="email"
        waarde={persoon?.email ?? ''}
        plaatshouder="bibi@ah.nl"
      />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-stone-600 dark:text-stone-400">Hoort bij</span>
        <select
          name="isIntern"
          defaultValue={persoon ? (persoon.isInternal ? 'ja' : 'nee') : 'ja'}
          className="rounded border border-stone-300 bg-white px-2 py-1 dark:border-stone-700 dark:bg-stone-950"
        >
          <option value="ja">Foodconnect</option>
          <option value="nee">Extern</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
          Rapporteert aan
        </span>
        <select
          name="managerId"
          defaultValue={persoon?.managerId ?? ''}
          className="rounded border border-stone-300 bg-white px-2 py-1 dark:border-stone-700 dark:bg-stone-950"
        >
          <option value="">— niemand —</option>
          {mogelijkeManagers
            .filter((m) => m.id !== persoon?.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.role ? ` · ${m.role}` : ''}
              </option>
            ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
          Aliassen en verhaspelingen, gescheiden door komma&apos;s
        </span>
        <input
          name="aliassen"
          defaultValue={persoon?.aliases.join(', ') ?? ''}
          placeholder="Bettina, de Tina, patina"
          className="rounded border border-stone-300 bg-white px-2 py-1 dark:border-stone-700 dark:bg-stone-950"
        />
        <span className="text-xs text-stone-500">
          Deze gaan mee in elke extractie. Hoe de spraakherkenning de naam verhaspelt hoort hier
          thuis.
        </span>
      </label>
    </div>
  );
}

function Veld({
  label,
  naam,
  waarde,
  plaatshouder,
  verplicht,
}: {
  label: string;
  naam: string;
  waarde?: string;
  plaatshouder?: string;
  verplicht?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-stone-600 dark:text-stone-400">{label}</span>
      <input
        name={naam}
        defaultValue={waarde}
        placeholder={plaatshouder}
        required={verplicht}
        className="rounded border border-stone-300 bg-white px-2 py-1 dark:border-stone-700 dark:bg-stone-950"
      />
    </label>
  );
}
