// biome-ignore-all lint/style/useNamingConvention: external API requirement

const apiUrl = "https://api.zeptomail.com/v1.1/email";
const apiKey = process.env.MAILER_API_KEY;
const sendEmailDisabled = !apiKey;

interface EmailProps {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail({
  to,
  subject,
  text,
}: EmailProps): Promise<Response> {
  if (sendEmailDisabled) {
    console.info("Email sending is disabled.");
    console.info({ subject, text, to });
    return Promise.resolve(Response.json({ ok: true }));
  }

  return await fetch(apiUrl, {
    body: JSON.stringify({
      from: { address: "hello@zoonk.com", name: "Zoonk" },
      htmlBody: text,
      subject,
      to: [{ email_address: { address: to } }],
    }),
    headers: {
      Accept: "application/json",
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}
