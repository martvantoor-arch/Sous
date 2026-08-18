// Adressen uit mailheaders lezen, en er de routering uit halen.
//
// Bewust klein gehouden. Volledige RFC 5322 parsing is een bibliotheek waard,
// maar wat hier binnenkomt is doorgestuurde post van Marten aan zichzelf, geen
// willekeurig internetverkeer. Wat we niet met zekerheid kunnen lezen laten we
// staan zoals het is: het ruwe adres blijft altijd bewaard.

export interface Adres {
  /** zoals het in de header stond */
  ruw: string;
  /** alleen het adres, kleine letters */
  adres: string;
  /** de weergavenaam, als die er was */
  naam: string | null;
}

/**
 * Leest `Marten van Toor <marten+blk@example.nl>` en `marten@example.nl`.
 *
 * Faalt het lezen, dan komt het ruwe adres terug met een leeg adresveld. Nooit
 * null: een mail zonder leesbare afzender is nog steeds een mail, en die hoort
 * binnen te komen met een vraag erbij in plaats van geweigerd te worden.
 */
export function leesAdres(ruw: string): Adres {
  const tekst = ruw.trim();
  const haakjes = tekst.match(/^(.*?)<([^>]+)>\s*$/);

  if (haakjes) {
    const naam = haakjes[1]!.trim().replace(/^"(.*)"$/, '$1').trim();
    return { ruw: tekst, adres: haakjes[2]!.trim().toLowerCase(), naam: naam || null };
  }

  return {
    ruw: tekst,
    adres: tekst.includes('@') ? tekst.toLowerCase() : '',
    naam: null,
  };
}

export function leesAdressen(ruw: string[] | null | undefined): Adres[] {
  return (ruw ?? []).flatMap((r) => (typeof r === 'string' && r.trim() ? [leesAdres(r)] : []));
}

/**
 * Het stuk achter de `+` in de lokale kant van een adres.
 *
 * `marten+blk@example.nl` levert `blk`. Geen plus, of niets erachter, levert
 * null. Meerdere plussen tellen als één label: `marten+blk+urgent@…` wordt
 * `blk+urgent`, en dat is dan gewoon een label dat nergens op matcht en dus in
 * de triage belandt. Beter dan de helft weggooien en op iets verkeerds
 * uitkomen.
 */
export function routeringsLabel(adres: string): string | null {
  const lokaal = adres.split('@')[0] ?? '';
  const plus = lokaal.indexOf('+');
  if (plus === -1) return null;

  const label = lokaal.slice(plus + 1).trim().toLowerCase();
  return label || null;
}

/**
 * Kiest uit alle ontvangende adressen degene met een routeringslabel.
 *
 * Een doorgestuurde mail heeft vaak meerdere ontvangers, waarvan er één de
 * hub is. Resend zet in `received_for` welk adres bij ons uitkwam; staat dat
 * er niet, dan zoeken we het in `to` en `cc`. Zit er in meer dan één een
 * label, dan wint de eerste — en dat is dan meteen iets om in de triage over
 * te vragen.
 */
export function kiesRoutering(adressen: Adres[]): { adres: Adres; label: string } | null {
  for (const a of adressen) {
    const label = routeringsLabel(a.adres);
    if (label) return { adres: a, label };
  }
  return null;
}
