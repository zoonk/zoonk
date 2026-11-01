import { escapeHtml } from "@zoonk/utils/escape-html";
import { getRefundLastDay } from "@zoonk/utils/subscription";
import { CANCEL_SUBSCRIPTION_URL } from "@zoonk/utils/url";
import { getTranslation } from "../translations/get-translations";
import {
  type BillingInterval,
  type Money,
  type Translation,
  details,
  fill,
  formatters,
  html,
  legalLinks,
  link,
  paragraph,
  planName,
  renderEmail,
  sendOnce,
} from "./plus-email-layout";

type CancellationChoice = "extraordinary" | "ordinary" | "withdrawal";

/** Who asked: the learner in Settings or by deleting their account. */
type CancellationSource = "accountDeletion" | "settings";

function withdrawalForm(t: Translation): string {
  const lines = t.withdrawalFormLines
    .map((line) => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`)
    .join("");

  return `<h3 style="margin:24px 0 8px;font-size:15px">${escapeHtml(t.withdrawalFormTitle)}</h3>${paragraph(html(t.withdrawalFormIntro))}<blockquote style="margin:0 0 16px;padding:0 0 0 12px;border-left:3px solid #e4e4e7">${lines}</blockquote>`;
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
