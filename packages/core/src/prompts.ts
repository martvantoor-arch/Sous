// Prompts staan als los bestand in src/prompts met een versienummer in de naam.
// Nooit inline in code: dan kun je de versie niet meer bij de output loggen.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type PromptVersion = 'extract-v1' | 'extract-v2' | 'extract-v3' | 'extract-v4' | 'reconcile-v1';

export interface LoadedPrompt {
  version: PromptVersion;
  /** Alles na de eerste `---` scheidingsregel: de systeemprompt zelf. */
  system: string;
}

const cache = new Map<PromptVersion, LoadedPrompt>();

export async function loadPrompt(version: PromptVersion): Promise<LoadedPrompt> {
  const cached = cache.get(version);
  if (cached) return cached;

  const path = fileURLToPath(new URL(`./prompts/${version}.md`, import.meta.url));
  const raw = await readFile(path, 'utf8');

  // De kop boven de eerste `---` is toelichting voor ons, niet voor het model.
  const lines = raw.split('\n');
  const sep = lines.findIndex((l) => l.trim() === '---');
  if (sep === -1) {
    throw new Error(`prompt ${version} mist de --- scheidingsregel`);
  }
  const system = lines.slice(sep + 1).join('\n').trim();
  if (!system) throw new Error(`prompt ${version} is leeg na de scheidingsregel`);

  const loaded: LoadedPrompt = { version, system };
  cache.set(version, loaded);
  return loaded;
}
