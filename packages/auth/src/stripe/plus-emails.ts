import { sendEmail } from "@zoonk/mailer";
import { formatPrice } from "@zoonk/utils/currency";
import { escapeHtml } from "@zoonk/utils/escape-html";
import { logError } from "@zoonk/utils/logger";
import { getRefundDeadline } from "@zoonk/utils/subscription";
import { CANCEL_SUBSCRIPTION_URL, PRIVACY_URL, TERMS_URL } from "@zoonk/utils/url";
import { getTranslation } from "../translations/get-translations";

type Money = { amount: number; currency: string };
type Translation = Awaited<ReturnType<typeof getTranslation>>;
type BillingInterval = "month" | "year";

const SELLER =
  "Zoonk Tecnologia e Educação Ltda · CNPJ 42.262.784/0001-76 · Setor SGAN 601, Módulo H, Sala 55, SS1, Parte 14, Edif Ion, Asa Norte, Brasília (DF), 70830-018, Brazil · hello@zoonk.com";

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

function html(
  template: string,
  values: Record<string, string> = {},
  links: Record<string, string> = {},
): string {
  return fill(escapeHtml(fill(template, values)), links);
}

function link(url: string, label = url): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

function paragraph(content: string): string {
  return `<p style="margin:0 0 16px">${content}</p>`;
}

function details(rows: [label: string, value: string][]): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#71717a;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<table role="presentation" style="border-collapse:collapse;margin:0 0 16px">${cells}</table>`;
}

function renderEmail(blocks: string[]): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.5;color:#18181b;max-width:560px">${blocks.join("")}<p style="margin:24px 0 0;font-size:12px;color:#71717a">${escapeHtml(SELLER)}</p></div>`;
}

function formatters(locale: string) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "UTC",
  });

  return {
    date: (value: Date) => date.format(value),
    dateTime: (value: Date) => dateTime.format(value),
    money: ({ amount, currency }: Money) => formatPrice(amount, currency, locale),
  };
}

function planName(t: Translation, interval: BillingInterval): string {
  return interval === "year" ? t.plusPlanYearly : t.plusPlanMonthly;
}

function legalLinks(t: Translation): string {
  return paragraph(
    html(
      t.plusEmailLegal,
      {},
      {
        privacyLink: link(PRIVACY_URL, t.plusEmailPrivacy),
        termsLink: link(TERMS_URL, t.plusEmailTerms),
      },
    ),
  );
}

function withdrawalForm(t: Translation): string {
  const lines = t.withdrawalFormLines
    .map((line) => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`)
    .join("");

  return `<h3 style="margin:24px 0 8px;font-size:15px">${escapeHtml(t.withdrawalFormTitle)}</h3>${paragraph(html(t.withdrawalFormIntro))}<blockquote style="margin:0 0 16px;padding:0 0 0 12px;border-left:3px solid #e4e4e7">${lines}</blockquote>`;
}

async function send({ body, subject, to }: { body: string; subject: string; to: string }) {
  const { error } = await sendEmail({ htmlBody: body, subject, to });

  if (error) {
    logError("Plus email failed", { error, subject });
  }
}

/** The contract's confirmation on a durable medium (EU Consumer Rights Directive, art. 8(7)). */
export async function sendPlusPurchaseEmail({
  email,
  interval,
  locale,
  paid,
  renewal,
  subscribedAt,
}: {
  email: string;
  interval: BillingInterval;
  locale: string;
  paid: Money;
  renewal: Money & { date: Date };
  subscribedAt: Date;
}): Promise<void> {
  const t = await getTranslation(locale);
  const format = formatters(locale);
  const cancelLink = link(CANCEL_SUBSCRIPTION_URL);

  const body = renderEmail([
    paragraph(html(t.plusPurchaseIntro)),
    details([
      [t.plusAccountLabel, email],
      [t.plusPlanLabel, planName(t, interval)],
      [
        t.plusPaidLabel,
        fill(t.plusPaidValue, { amount: format.money(paid), date: format.date(subscribedAt) }),
      ],
      [
        t.plusRenewsLabel,
        fill(t.plusRenewsValue, { amount: format.money(renewal), date: format.date(renewal.date) }),
      ],
    ]),
    paragraph(html(interval === "year" ? t.plusRenewsYearly : t.plusRenewsMonthly)),
    paragraph(html(t.plusPurchaseCancel, {}, { cancelLink })),
    paragraph(
      html(
        t.plusPurchaseRefund,
        { date: format.date(getRefundDeadline(subscribedAt)) },
        { cancelLink },
      ),
    ),
    interval === "year" ? paragraph(html(t.plusPurchaseYearlyRefund)) : "",
    legalLinks(t),
    withdrawalForm(t),
  ]);

  await send({ body, subject: t.plusPurchaseSubject, to: email });
}

/** The receipt of a cancellation or withdrawal, with its date and time (BGB §§ 312k and 356a). */
export async function sendPlusCancellationEmail({
  email,
  endsAt,
  interval,
  locale,
  name,
  receivedAt,
  refund,
  refundableUntil,
  withdrawn,
}: {
  email: string;
  endsAt: Date;
  interval: BillingInterval;
  locale: string;
  name: string;
  receivedAt: Date;
  refund: Money | null;
  refundableUntil: Date | null;
  withdrawn: boolean;
}): Promise<void> {
  const t = await getTranslation(locale);
  const format = formatters(locale);
  const endsNow = endsAt <= receivedAt;

  const refundSentence = refund
    ? `${html(withdrawn ? t.plusRefundFull : t.plusRefundUnstarted, { amount: format.money(refund) })} ${html(t.plusRefundTiming)}`
    : html(t.plusNoMoreCharges);

  const ending = endsNow ? html(t.plusEndedNow) : html(t.plusEndsOn, { date: format.date(endsAt) });

  const body = renderEmail([
    paragraph(
      html(withdrawn ? t.plusWithdrawalReceived : t.plusCancellationReceived, {
        dateTime: format.dateTime(receivedAt),
      }),
    ),
    details([
      ...(name ? [[t.plusNameLabel, name] as [string, string]] : []),
      [t.plusAccountLabel, email],
      [t.plusPlanLabel, planName(t, interval)],
      [t.plusEndsLabel, format.date(endsAt)],
      ...(refund ? [[t.plusRefundLabel, format.money(refund)] as [string, string]] : []),
    ]),
    paragraph(`${ending} ${refundSentence}`),
    refundableUntil
      ? paragraph(
          html(
            t.plusStillRefundable,
            { date: format.date(refundableUntil) },
            { cancelLink: link(CANCEL_SUBSCRIPTION_URL) },
          ),
        )
      : "",
    paragraph(html(t.plusEmailQuestions)),
    legalLinks(t),
  ]);

  await send({
    body,
    subject: withdrawn ? t.plusWithdrawalSubject : t.plusCancellationSubject,
    to: email,
  });
}
