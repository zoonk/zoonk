import { TERMS_URL } from "@zoonk/utils/url";
import {
  getRequestLocale,
  getTranslation,
  isTranslatedLocale,
} from "../translations/get-translations";
import { writeSubscriptionMetadata } from "./subscription-metadata";
import type Stripe from "stripe";

/** Stripe's `auto` and any language we don't translate fall back to the request's language. */
async function getCheckoutLocale(stripeLocale?: string): Promise<string> {
  const language = stripeLocale?.split("-")[0];

  return language && isTranslatedLocale(language) ? language : getRequestLocale();
}

/**
 * Checkout's last screen states the renewal, cancellation and refund terms (Japan's final
 * confirmation screen) and has the buyer confirm the Terms (Turkey's pre-contract information).
 * Stripe refuses terms consent until the Dashboard's public details have a terms of service URL.
 */
export async function getCheckoutSessionParams({
  annual,
  locale,
  timeZone,
}: {
  annual: boolean;
  locale?: string;
  timeZone?: string;
}): Promise<Stripe.Checkout.SessionCreateParams> {
  const language = await getCheckoutLocale(locale);
  const t = await getTranslation(language);

  return {
    allow_promotion_codes: true,
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      submit: { message: annual ? t.checkoutYearlyRenewal : t.checkoutMonthlyRenewal },
      terms_of_service_acceptance: {
        message: t.checkoutTermsConsent.replace("{termsUrl}", TERMS_URL),
      },
    },
    subscription_data: { metadata: writeSubscriptionMetadata({ locale: language, timeZone }) },
  };
}
