// Uitgaande mail via Resend. Bewust met `fetch` in plaats van de SDK: we sturen
// één soort bericht, en dat is één POST.
//
// Zonder `RESEND_API_KEY` valt hij terug op de log. Dat is geen stille storing
// maar een werkende ontwikkelmodus: de link staat dan in de serverlog, zodat je
// lokaal kunt inloggen zonder mailaccount. In productie ontbreekt de sleutel
// niet, en als dat wel zo is zie je het meteen in de log.
const AFZENDER = process.env.MAIL_FROM ?? 'MeetingHub <onboarding@resend.dev>';

export async function stuurLoginLink(email: string, link: string): Promise<void> {
  const sleutel = process.env.RESEND_API_KEY;

  if (!sleutel) {
    console.warn(
      `[login] RESEND_API_KEY ontbreekt, geen mail verstuurd. Link voor ${email}:\n${link}`,
    );
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sleutel}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: AFZENDER,
      to: [email],
      subject: 'Inloggen bij MeetingHub',
      text: [
        'Klik op de link hieronder om in te loggen bij MeetingHub.',
        '',
        link,
        '',
        'De link werkt vijftien minuten en één keer.',
        'Heb je dit niet aangevraagd, dan hoef je niets te doen.',
      ].join('\n'),
    }),
  });

  if (!res.ok) {
    // De reden hoort in de log, niet op het scherm: of een adres bestaat is
    // niets wat een bezoeker hoort te leren.
    console.error(`[login] Resend gaf ${res.status}: ${await res.text()}`);
    throw new Error('de mail kon niet verstuurd worden');
  }
}
