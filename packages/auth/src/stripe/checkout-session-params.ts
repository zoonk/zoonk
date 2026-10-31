import { TERMS_URL } from "@zoonk/utils/url";
import { getRequestTranslation, getTranslation } from "../translations/get-translations";
import type Stripe from "stripe";

function getCheckoutTranslation(stripeLocale?: string) {
  const language = stripeLocale?.split("-")[0];
  return language ? getTranslation(language) : getRequestTranslation();
}

/**
 * Checkout's last screen states the renewal, cancellation and refund terms (Japan's final
 * confirmation screen) and has the buyer confirm the Terms (Turkey's pre-contract information).
 * Stripe refuses terms consent until the Dashboard's public details have a terms of service URL.
 */
export async function getCheckoutSessionParams({
  annual,
  locale,
}: {
  annual: boolean;
  locale?: string;
}): Promise<Stripe.Checkout.SessionCreateParams> {
  const t = await getCheckoutTranslation(locale);

  return {
    allow_promotion_codes: true,
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      submit: { message: annual ? t.checkoutYearlyRenewal : t.checkoutMonthlyRenewal },
      terms_of_service_acceptance: {
        message: t.checkoutTermsConsent.replace("{termsUrl}", TERMS_URL),
      },
    },
  };
}
