import { safeAsync } from "@zoonk/utils/error";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { APPLE_SUBSCRIPTIONS_URL, GOOGLE_PLAY_SUBSCRIPTIONS_URL } from "@zoonk/utils/url";
import { getRequestLocale, getTranslation } from "../translations/get-translations";
import {
  type BillingInterval,
  type Money,
  details,
  formatters,
  html,
  legalLinks,
  link,
  paragraph,
  planName,
  renderEmail,
  sendOnce,
} from "./plus-email-layout";

type StoreProvider = "apple" | "google";

/** Website Plus ended because the learner already pays for Plus through a store. */
export async function sendWebPlusEndedBesideStoreEmail({
  email,
  interval,
  locale,
  refund,
  store,
  timeZone,
}: {
  email: string;
  interval: BillingInterval;
  locale: string;
  refund: Money | null;
  store: StoreProvider;
  timeZone: string | null;
}): Promise<void> {
  const t = await getTranslation(locale);
  const format = formatters({ locale, timeZone });

  const refundSentence = refund
    ? `${html(t.plusRefundFull, { amount: format.money(refund) })} ${html(t.plusRefundTiming)}`
    : html(t.plusNoMoreCharges);

  const body = renderEmail([
    paragraph(html(store === "apple" ? t.plusWebEndedBesideApple : t.plusWebEndedBesideGoogle)),
    details([
      [t.plusAccountLabel, email],
      [t.plusPlanLabel, planName(t, interval)],
      ...(refund ? [[t.plusRefundLabel, format.money(refund)] as [string, string]] : []),
    ]),
    paragraph(refundSentence),
    paragraph(html(t.plusEmailQuestions)),
    legalLinks(t),
  ]);

  await sendOnce({ body, subject: t.plusAlreadyActiveSubject, to: email });
}

/**
 * Stores charge before we hear of a purchase, so a second one can only be canceled by the learner.
 * Stores don't tell the learner's language: it's the app's request's, and English for a store's
 * own notification.
 */
export async function sendPlusTwiceEmail({
  email,
  store,
}: {
  email: string;
  /** Where the newer subscription was bought, which the learner is asked to cancel. */
  store: StoreProvider;
}): Promise<void> {
  const { data: locale } = await safeAsync(getRequestLocale);
  const t = await getTranslation(locale ?? DEFAULT_LOCALE);

  const cancelNewer =
    store === "apple"
      ? html(t.plusTwiceCancelApple, {}, { manageLink: link(APPLE_SUBSCRIPTIONS_URL) })
      : html(t.plusTwiceCancelGoogle, {}, { manageLink: link(GOOGLE_PLAY_SUBSCRIPTIONS_URL) });

  const body = renderEmail([
    paragraph(html(t.plusTwiceIntro)),
    paragraph(cancelNewer),
    paragraph(html(t.plusEmailQuestions)),
    legalLinks(t),
  ]);

  await sendOnce({ body, subject: t.plusTwiceSubject, to: email });
}
