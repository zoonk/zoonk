const apiUrl = "https://api.zeptomail.com/v1.1/email";
const apiKey = process.env.MAILER_API_KEY;
const sendEmailDisabled = !apiKey;

interface EmailProps {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail({ to, subject, text }: EmailProps) {
  if (sendEmailDisabled) {
    console.info("Email sending is disabled.");
    console.info({ to, subject, text });
    return Promise.resolve(Response.json({ ok: true }));
  }

  return await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({
      from: { address: "hello@zoonk.com", name: "Zoonk" },
      to: [{ email_address: { address: to } }],
      subject,
      htmlBody: text,
    }),
  });
}
