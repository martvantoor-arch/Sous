// De brief bij de envelop halen.
//
// Resend levert de inhoud van een inkomende mail niet mee in de webhook, dus
// die halen we hier op. Draait in de worker en niet in de route: pg-boss geeft
// het opnieuw proberen gratis, en een mail die door een storing bij Resend
// verloren gaat krijg je nooit meer terug.
import { getDb, sourceMail, sources, eq } from '@meetinghub/db';
import { enqueueExtraction } from '../queue.js';

const API = 'https://api.resend.com/emails/receiving';

interface OpgehaaldeMail {
  text?: string | null;
  html?: string | null;
  subject?: string | null;
  headers?: Record<string, unknown> | null;
}

/**
 * Haalt de body op en zet de bron klaar voor extractie.
 *
 * `raw_text` krijgt de platte tekst als die er is. Is er alleen html, dan
 * wordt die omgezet — en blijft het origineel daarnaast staan in `body_html`.
 * Kernprincipe 1: de ruwe tekst is heilig, dus we gooien de html niet weg
 * omdat we er een leesbare versie van gemaakt hebben.
 */
export async function haalMailBody(sourceId: string, emailId: string): Promise<void> {
  const db = getDb();

  const [bron] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!bron) throw new Error(`bron ${sourceId} bestaat niet`);

  if (bron.rawText) {
    // Al opgehaald. Een dubbele levering mag de bron niet overschrijven.
    console.log(`[mail] ${sourceId} had zijn body al, overgeslagen`);
    return;
  }

  const mail = await fetchMail(emailId);

  const plat = mail.text?.trim() || null;
  const html = mail.html?.trim() || null;
  const tekst = plat ?? (html ? htmlNaarTekst(html) : null);

  if (!tekst) {
    throw new Error(`mail ${emailId} kwam zonder leesbare body binnen`);
  }

  await db.update(sources).set({ rawText: tekst }).where(eq(sources.id, sourceId));
  await db
    .update(sourceMail)
    .set({ bodyHtml: html, headers: mail.headers ?? null })
    .where(eq(sourceMail.sourceId, sourceId));

  await enqueueExtraction({ sourceId });
  console.log(`[mail] ${sourceId} body opgehaald (${tekst.length} tekens), extractie in wachtrij`);
}

async function fetchMail(emailId: string): Promise<OpgehaaldeMail> {
  const sleutel = process.env.RESEND_API_KEY;
  if (!sleutel) throw new Error('RESEND_API_KEY ontbreekt, mailbody niet op te halen');

  const res = await fetch(`${API}/${encodeURIComponent(emailId)}`, {
    headers: { authorization: `Bearer ${sleutel}` },
  });

  if (!res.ok) {
    // De job gaat hierop opnieuw de wachtrij in; dat is precies de bedoeling.
    throw new Error(`Resend gaf ${res.status} bij het ophalen van ${emailId}: ${await res.text()}`);
  }

  return (await res.json()) as OpgehaaldeMail;
}

/**
 * Html naar leesbare tekst, alleen als er geen platte versie was.
 *
 * Bewust ruw: blokelementen worden regelovergangen, de rest verdwijnt. Het
 * doel is een tekst waar de extractie mee uit de voeten kan, niet een perfecte
 * weergave — die staat nog in `body_html`.
 */
export function htmlNaarTekst(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
