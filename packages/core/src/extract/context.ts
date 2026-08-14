// Het woordenboek, de personen en de projecten gaan bij elke extractie mee.
// Zonder de terms tabel leest "bij elkaar" als gewone taal en gaat de hele
// meeting verkeerd.
import { getDb, people, projects, terms, eq } from '@meetinghub/db';

export interface ExtractionContext {
  /** Blok dat achter de systeemprompt geplakt wordt. */
  text: string;
}

export async function buildContext(): Promise<ExtractionContext> {
  const db = getDb();
  const [termRows, peopleRows, projectRows] = await Promise.all([
    db.select().from(terms),
    db.select().from(people).where(eq(people.active, true)),
    db.select().from(projects),
  ]);

  const termLines = termRows.map((t) => {
    const parts = [`- ${t.term}`];
    if (t.expansion) parts.push(`(${t.expansion})`);
    if (t.domain) parts.push(`[${t.domain}]`);
    if (t.variants.length) parts.push(`— verhaspelingen: ${t.variants.join(', ')}`);
    if (t.note) parts.push(`— let op: ${t.note}`);
    return parts.join(' ');
  });

  const peopleLines = peopleRows.map((p) => {
    const parts = [`- ${p.id} | ${p.name}`];
    if (p.role) parts.push(`| ${p.role}`);
    if (p.organisation) parts.push(`| ${p.organisation}`);
    parts.push(p.isInternal ? '| intern' : '| extern');
    if (p.aliases.length) parts.push(`| aliassen: ${p.aliases.join(', ')}`);
    return parts.join(' ');
  });

  const projectLines = projectRows.map((p) => {
    const parts = [`- ${p.id} | ${p.name}`];
    if (p.code) parts.push(`| ${p.code}`);
    parts.push(`| ${p.status}`);
    if (p.aliases.length) parts.push(`| aliassen: ${p.aliases.join(', ')}`);
    if (p.description) parts.push(`\n    ${p.description}`);
    return parts.join(' ');
  });

  const text = [
    '# Woordenboek',
    termLines.join('\n') || '(leeg)',
    '',
    '# Bekende personen',
    'Koppel op de uuid in de eerste kolom. Maak nooit zelf een persoon aan.',
    peopleLines.join('\n') || '(leeg)',
    '',
    '# Bekende projecten',
    'Koppel op de uuid in de eerste kolom. Maak nooit zelf een project aan.',
    projectLines.join('\n') || '(leeg)',
  ].join('\n');

  return { text };
}
