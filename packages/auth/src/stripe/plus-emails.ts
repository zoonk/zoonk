import { sendEmail } from "@zoonk/mailer";
import { formatPrice } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";
import { escapeHtml } from "@zoonk/utils/escape-html";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { logError } from "@zoonk/utils/logger";
import { getRefundLastDay } from "@zoonk/utils/subscription";
import { CANCEL_SUBSCRIPTION_URL, PRIVACY_URL, TERMS_URL } from "@zoonk/utils/url";
import { getTranslation } from "../translations/get-translations";

type Money = { amount: number; currency: string };
type Translation = Awaited<ReturnType<typeof getTranslation>>;
type BillingInterval = "month" | "year";
type CancellationChoice = "extraordinary" | "ordinary" | "withdrawal";

/** Who asked: the learner in Settings or by deleting their account. */
type CancellationSource = "accountDeletion" | "settings";

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

/**
 * Dates read in the learner's own zone, or UTC when it isn't known; `day` formats a calendar date
 * kept as UTC midnight.
 */
function formatters({ locale, timeZone }: { locale: string; timeZone: string | null }) {
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
    throw error;
  }
}

/** Sent from the request that bought or canceled Plus, which a failed email mustn't undo. */
async function sendOnce(email: { body: string; subject: string; to: string }) {
  const { error } = await safeAsync(() => send(email));

  if (error) {
    logError("Plus email failed", { error, subject: email.subject });
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
  timeZone,
}: {
  email: string;
  interval: BillingInterval;
  locale: string;
  paid: Money;
  renewal: Money & { date: Date };
  subscribedAt: Date;
  timeZone: string | null;
}): Promise<void> {
  const t = await getTranslation(locale);
  const format = formatters({ locale, timeZone });
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
        { date: format.day(getRefundLastDay({ subscribedAt, timeZone: format.zone })) },
        { cancelLink },
      ),
    ),
    interval === "year" ? paragraph(html(t.plusPurchaseYearlyRefund)) : "",
    legalLinks(t),
    withdrawalForm(t),
  ]);

  await sendOnce({ body, subject: t.plusPurchaseSubject, to: email });
}

function refundTemplate({
  choice,
  t,
  withdrawn,
}: {
  choice: CancellationChoice;
  t: Translation;
  withdrawn: boolean;
}): string {
  if (withdrawn) {
    return t.plusRefundFull;
  }

  return choice === "extraordinary" ? t.plusRefundDaysLeft : t.plusRefundUnstarted;
}

function receivedTemplate({
  choice,
  source,
  t,
}: {
  choice: CancellationChoice;
  source: CancellationSource;
  t: Translation;
}): string {
  if (source === "accountDeletion") {
    return t.plusAccountDeletedReceived;
  }

  return {
    extraordinary: t.plusExtraordinaryReceived,
    ordinary: t.plusCancellationReceived,
    withdrawal: t.plusWithdrawalReceived,
  }[choice];
}

/** The receipt of a cancellation or withdrawal, with its date and time (BGB §§ 312k and 356a). */
export async function sendPlusCancellationEmail({
  canKeepPlus,
  choice,
  email,
  endsAt,
  interval,
  locale,
  name,
  reason,
  receivedAt,
  refund,
  refundableUntil,
  source,
  timeZone,
}: {
  /** Only the renewal stopped, so Keep Plus can turn it back on. */
  canKeepPlus: boolean;
  choice: CancellationChoice;
  email: string;
  endsAt: Date;
  interval: BillingInterval;
  locale: string;
  name: string;
  reason: string | null;
  receivedAt: Date;
  refund: Money | null;
  refundableUntil: Date | null;
  source: CancellationSource;
  timeZone: string | null;
}): Promise<void> {
  const t = await getTranslation(locale);
  const format = formatters({ locale, timeZone });
  const endsNow = endsAt <= receivedAt;
  const withdrawn = choice === "withdrawal";
  const received = receivedTemplate({ choice, source, t });

  const refundSentence = refund
    ? `${html(refundTemplate({ choice, t, withdrawn }), { amount: format.money(refund) })} ${html(t.plusRefundTiming)}`
    : html(t.plusNoMoreCharges);

  const ending = endsNow ? html(t.plusEndedNow) : html(t.plusEndsOn, { date: format.date(endsAt) });

  const body = renderEmail([
    paragraph(html(received, { dateTime: format.dateTime(receivedAt) })),
    details([
      ...(name ? [[t.plusNameLabel, name] as [string, string]] : []),
      [t.plusAccountLabel, email],
      [t.plusPlanLabel, planName(t, interval)],
      ...(reason ? [[t.plusReasonLabel, reason] as [string, string]] : []),
      [t.plusEndsLabel, format.date(endsAt)],
      ...(refund ? [[t.plusRefundLabel, format.money(refund)] as [string, string]] : []),
    ]),
    paragraph(`${ending} ${refundSentence}`),
    canKeepPlus ? paragraph(html(t.plusKeepPlusHint)) : "",
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

  await sendOnce({
    body,
    subject: withdrawn ? t.plusWithdrawalSubject : t.plusCancellationSubject,
    to: email,
  });
}

function choiceName(t: Translation, choice: CancellationChoice): string {
  return {
    extraordinary: t.plusChoiceExtraordinary,
    ordinary: t.plusChoiceOrdinary,
    withdrawal: t.plusChoiceWithdrawal,
  }[choice];
}

/**
 * The receipt of a request sent from the cancel form without logging in (BGB § 312k), to the
 * account's own address. Knowing an email isn't enough to end its Plus, so nothing changes until
 * support confirms with the owner, and a reply reaches support if it wasn't them.
 */
export async function sendPlusCancellationRequestEmail({
  choice,
  email,
  locale,
  name,
  reason,
  receivedAt,
  timeZone,
}: {
  choice: CancellationChoice;
  email: string;
  locale: string;
  name: string;
  reason: string | null;
  receivedAt: Date;
  timeZone: string | null;
}): Promise<void> {
  const t = await getTranslation(locale);
  const format = formatters({ locale, timeZone });

  const body = renderEmail([
    paragraph(html(t.plusRequestReceived, { dateTime: format.dateTime(receivedAt) })),
    details([
      [t.plusNameLabel, name],
      [t.plusAccountLabel, email],
      [t.plusRequestLabel, choiceName(t, choice)],
      ...(reason ? [[t.plusReasonLabel, reason] as [string, string]] : []),
    ]),
    paragraph(html(t.plusRequestNextStep)),
    paragraph(html(t.plusRequestNotYou)),
    legalLinks(t),
  ]);

  await sendOnce({ body, subject: t.plusRequestSubject, to: email });
}
