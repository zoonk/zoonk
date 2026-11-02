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
  send,
} from "./plus-email-layout";

type StoreProvider = "apple" | "google";

/** A website subscription ended because the learner already had Plus. */
export type EndedWebPlus = {
  email: string;
  interval: BillingInterval;
  /** The store whose Plus the learner keeps. */
  keptStore: StoreProvider;
  locale: string;
  refund: Money | null;
  timeZone: string | null;
};

/** Stores don't tell the learner's language: it's the app's request's, or English for a store's own notification. */
export async function readStorePurchaseLocale(): Promise<string> {
  const { data: locale } = await safeAsync(getRequestLocale);
  return locale ?? DEFAULT_LOCALE;
}

export async function sendWebPlusEndedEmail({
  email,
  interval,
  keptStore,
  locale,
  refund,
  timeZone,
}: EndedWebPlus): Promise<void> {
  const t = await getTranslation(locale);
  const format = formatters({ locale, timeZone });

  const refundSentence = refund
    ? `${html(t.plusRefundFull, { amount: format.money(refund) })} ${html(t.plusRefundTiming)}`
    : html(t.plusNoMoreCharges);

  const body = renderEmail([
    paragraph(html(keptStore === "apple" ? t.plusWebEndedBesideApple : t.plusWebEndedBesideGoogle)),
    details([
      [t.plusAccountLabel, email],
      [t.plusPlanLabel, planName(t, interval)],
      ...(refund ? [[t.plusRefundLabel, format.money(refund)] as [string, string]] : []),
    ]),
    paragraph(refundSentence),
    paragraph(html(t.plusEmailQuestions)),
    legalLinks(t),
  ]);

  await send({ body, subject: t.plusAlreadyActiveSubject, to: email });
}

/** Stores charge before we hear of a purchase, so a second one can only be canceled by the learner. */
export async function sendPlusTwiceEmail({
  email,
  locale,
  store,
}: {
  email: string;
  locale: string;
  /** Where the newer subscription was bought, which the learner is asked to cancel. */
  store: StoreProvider;
}): Promise<void> {
  const t = await getTranslation(locale);

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

  await send({ body, subject: t.plusTwiceSubject, to: email });
}
