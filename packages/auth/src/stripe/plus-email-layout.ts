import { sendEmail } from "@zoonk/mailer";
import { formatPrice } from "@zoonk/utils/currency";
import { escapeHtml } from "@zoonk/utils/escape-html";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { getMainPageUrl } from "@zoonk/utils/url";
import { type getTranslation } from "../translations/get-translations";

export type Money = { amount: number; currency: string };
export type Translation = Awaited<ReturnType<typeof getTranslation>>;
export type BillingInterval = "month" | "year";

const SELLER =
  "Zoonk Tecnologia e Educação Ltda · CNPJ 42.262.784/0001-76 · Setor SGAN 601, Módulo H, Sala 55, SS1, Parte 14, Edif Ion, Asa Norte, Brasília (DF), 70830-018, Brazil · hello@zoonk.com";

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

export function html(
  template: string,
  values: Record<string, string> = {},
  links: Record<string, string> = {},
): string {
  return fill(escapeHtml(fill(template, values)), links);
}

export function link(url: string, label = url): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

export function paragraph(content: string): string {
  return `<p style="margin:0 0 16px">${content}</p>`;
}

export function details(rows: [label: string, value: string][]): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#71717a;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<table role="presentation" style="border-collapse:collapse;margin:0 0 16px">${cells}</table>`;
}

export function renderEmail(blocks: string[]): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.5;color:#18181b;max-width:560px">${blocks.join("")}<p style="margin:24px 0 0;font-size:12px;color:#71717a">${escapeHtml(SELLER)}</p></div>`;
}

/**
 * Dates read in the learner's own zone, or UTC when it isn't known; `day` formats a calendar date
 * kept as UTC midnight.
 */
export function formatters({ locale, timeZone }: { locale: string; timeZone: string | null }) {
  const formattingLocale = getFormattingLocale(locale);
  const zone = timeZone ?? "UTC";
  const date = new Intl.DateTimeFormat(formattingLocale, { dateStyle: "long", timeZone: zone });
  const day = new Intl.DateTimeFormat(formattingLocale, { dateStyle: "long", timeZone: "UTC" });

  const dateTime = new Intl.DateTimeFormat(formattingLocale, {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: zone,
  });

  return {
    date: (value: Date) => date.format(value),
    dateTime: (value: Date) => dateTime.format(value),
    day: (value: Date) => day.format(value),
    money: ({ amount, currency }: Money) => formatPrice(amount, currency, locale),
    zone,
  };
}

export function planName(t: Translation, interval: BillingInterval): string {
  return interval === "year" ? t.plusPlanYearly : t.plusPlanMonthly;
}

export function legalLinks({ locale, t }: { locale: string; t: Translation }): string {
  return paragraph(
    html(
      t.plusEmailLegal,
      {},
      {
        privacyLink: link(getMainPageUrl({ locale, path: "/privacy" }), t.plusEmailPrivacy),
        termsLink: link(getMainPageUrl({ locale, path: "/terms" }), t.plusEmailTerms),
      },
    ),
  );
}

export async function send({ body, subject, to }: { body: string; subject: string; to: string }) {
  const { error } = await sendEmail({ htmlBody: body, subject, to });

  if (error) {
    throw error;
  }
}
