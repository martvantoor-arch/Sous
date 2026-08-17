// Waar de app draait, gezien vanaf de buitenkant.
//
// Dit is lastiger dan het lijkt. De inloglink moet absoluut zijn, want hij komt
// in een mailtje terecht en daar is "relatief" niets waard. Tegelijk weet het
// proces zelf niet op welk domein het staat: het luistert op een poort achter
// een proxy.
//
// Volgorde met opzet:
//
// 1. `APP_URL`, als die gezet is. Expliciet wint altijd.
// 2. `RAILWAY_PUBLIC_DOMAIN`, die Railway zelf invult.
// 3. De `x-forwarded-host` header, die de proxy meestuurt met het domein dat de
//    bezoeker gebruikte.
// 4. De gewone `host` header.
//
// Komt hij nergens uit, dan geeft hij `null` in plaats van een gok. Een link
// naar localhost in een mailbox is erger dan een duidelijke foutmelding: de
// eerste ziet eruit alsof het werkte.
import { headers } from 'next/headers';

export async function basisUrl(): Promise<string | null> {
  const expliciet = process.env.APP_URL?.trim();
  if (expliciet) return normaliseer(expliciet);

  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return normaliseer(railway);

  const kop = await headers();
  const host = kop.get('x-forwarded-host')?.trim() || kop.get('host')?.trim();
  if (!host) return null;

  // Achter een proxy weet alleen die proxy of het https was.
  const protocol = kop.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https';
  return normaliseer(`${protocol}://${host}`);
}

function normaliseer(waarde: string): string {
  const met = /^https?:\/\//i.test(waarde) ? waarde : `https://${waarde}`;
  return met.replace(/\/+$/, '');
}
