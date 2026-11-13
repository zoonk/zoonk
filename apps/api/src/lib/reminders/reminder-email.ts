import { MailerError, sendEmail } from "@zoonk/mailer";
import { escapeHtml } from "@zoonk/utils/escape-html";
import { getMainPageUrl } from "@zoonk/utils/url";
import { getListUnsubscribeHeaders, getUnsubscribePageUrl } from "../study-reminder-links";
import { type ReminderText, type ReminderWords } from "./reminder-copy";

/** `refused`: ZeptoMail answered with an error, so nothing was sent. */
export type EmailOutcome = "refused" | "sent" | "unknown";

type ReminderLinks = { settings: string; today: string; unsubscribe: string };

type ReminderEmail = {
  address: string;
  goalId: string;
  locale: string;
  text: ReminderText;
  unsubscribeToken: string;
  words: ReminderWords["email"];
};

function link(url: string, label: string, style = ""): string {
  return `<a href="${escapeHtml(url)}" style="${style}">${escapeHtml(label)}</a>`;
}

function renderHtml({
  links,
  text,
  words,
}: {
  links: ReminderLinks;
  text: ReminderText;
  words: ReminderWords["email"];
}) {
  const button =
    "display:inline-block;padding:10px 18px;line-height:24px;border-radius:10px;background:#18181b;color:#fafafa;text-decoration:none;font-weight:600";

  // Each line is its own block with room around it, so a thumb on a phone hits the link it means
  // and the three lines are evenly spaced.
  const footerLine = "display:inline-block;padding:6px 0;color:#71717a";

  const footer = [
    `<span style="${footerLine}">${escapeHtml(words.why)}</span>`,
    link(links.settings, words.settings, footerLine),
    link(links.unsubscribe, words.unsubscribe, footerLine),
  ].join("<br>");

  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#18181b;max-width:560px"><h1 style="font-size:20px;font-weight:600;margin:0 0 8px">${escapeHtml(text.title)}</h1><p style="margin:0 0 20px">${escapeHtml(text.body)}</p><p style="margin:0 0 28px">${link(links.today, words.open, button)}</p><p style="margin:0;font-size:12px;color:#71717a">${footer}</p></div>`;
}

/**
 * ZeptoMail documents no refusal as safe to retry and no code for an invalid address, so a failed
 * send is never retried or turned off: an unknown answer may already be in the inbox.
 */
export async function sendReminderEmail(email: ReminderEmail): Promise<EmailOutcome> {
  const { address, goalId, locale, text, unsubscribeToken, words } = email;

  const links: ReminderLinks = {
    settings: getMainPageUrl({ locale, path: "/settings/reminders" }),
    today: getMainPageUrl({ locale, path: `/today?goal=${encodeURIComponent(goalId)}` }),
    unsubscribe: getUnsubscribePageUrl({ locale, token: unsubscribeToken }),
  };

  const { error } = await sendEmail({
    headers: getListUnsubscribeHeaders(unsubscribeToken),
    htmlBody: renderHtml({ links, text, words }),
    sender: "reminders",
    subject: text.title,
    textBody: [
      text.title,
      text.body,
      `${words.open}: ${links.today}`,
      words.why,
      `${words.settings}: ${links.settings}`,
      `${words.unsubscribe}: ${links.unsubscribe}`,
    ].join("\n\n"),
    to: address,
  });

  if (!error) {
    return "sent";
  }

  return error instanceof MailerError ? "refused" : "unknown";
}
