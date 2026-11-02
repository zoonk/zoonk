import {
  getRequestLocale,
  getTranslation,
  isTranslatedLocale,
} from "../translations/get-translations";
import type Stripe from "stripe";

/** Stripe's `auto` and any language we don't translate fall back to the request's language. */
async function getCheckoutLocale(stripeLocale?: string): Promise<string> {
  const language = stripeLocale?.split("-")[0];

  return language && isTranslatedLocale(language) ? language : getRequestLocale();
}

export async function getCheckoutSessionParams({
  annual,
  locale,
}: {
  annual: boolean;
  locale?: string;
}): Promise<Stripe.Checkout.SessionCreateParams> {
  const language = await getCheckoutLocale(locale);
  const t = await getTranslation(language);

  return {
    allow_promotion_codes: true,
    custom_text: {
      submit: { message: annual ? t.checkoutYearlyRenewal : t.checkoutMonthlyRenewal },
    },
    subscription_data: { metadata: { locale: language } },
  };
}
