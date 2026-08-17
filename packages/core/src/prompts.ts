// Prompts staan als los bestand in src/prompts met een versienummer in de naam.
// Nooit inline in code: dan kun je de versie niet meer bij de output loggen.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type PromptVersion =
  | 'extract-v1'
  | 'extract-v2'
  | 'extract-v3'
  | 'extract-v4'
  | 'extract-v5'
  | 'reconcile-v1'
  | 'reconcile-v2';

export interface LoadedPrompt {
  version: PromptVersion;
  /** Alles na de eerste `---` scheidingsregel: de systeemprompt zelf. */
  system: string;
  /**
   * Sha256 over `system`, eerste twaalf tekens. De versienaam zegt welk bestand
   * er gebruikt is; deze zegt welke inhoud dat bestand had. Dat verschil telt
   * zodra een prompt wordt bijgewerkt vóór zijn eerste meting, of zodra een
   * deploy achterloopt op wat er gepusht is.
   */
  fingerprint: string;
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

  const fingerprint = createHash('sha256').update(system, 'utf8').digest('hex').slice(0, 12);
  const loaded: LoadedPrompt = { version, system, fingerprint };
  cache.set(version, loaded);
  return loaded;
}
