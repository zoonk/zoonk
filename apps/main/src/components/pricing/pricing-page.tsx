import {
  PricingClose,
  PricingHero,
  PricingPlans,
  PricingQuestions,
  getPlusPricingMetadata,
} from "@/components/pricing/plus-pricing";
import { PricingCovers } from "@/components/pricing/pricing-covers";
import { PublicPage } from "@/components/public/public-page";
import { getPlusPrices } from "@/data/subscriptions/get-plus-prices";
import { getLocalizedAlternates } from "@/lib/metadata/localized-url";
import { BILLING_CURRENCIES, DEFAULT_CURRENCY } from "@zoonk/utils/currency";
import { type Metadata } from "next";
import { lang } from "next/root-params";

/** Every currency variant of the pricing page is the pricing page: one address, `/pricing`. */
export async function getPricingPageMetadata(): Promise<Metadata> {
  const metadata = await getPlusPricingMetadata();
  const language = await lang();
  return { ...metadata, alternates: getLocalizedAlternates({ href: "/pricing", language }) };
}

/** A billing currency the page has prices for; anything else gets the default currency's. */
function readCurrency(currency: string): string {
  return BILLING_CURRENCIES.includes(currency) ? currency : DEFAULT_CURRENCY;
}

/**
 * Pricing in the public frame, for everyone: the two plans, then what the free plan covers drawn
 * on a plan's own road, the questions people ask before paying, and, for a visitor, starting free
 * once more. A visitor's next step is starting free or getting Plus, a learner's subscribing, and
 * a subscriber's managing their plan. The page is static: its HTML is a visitor's, and the
 * browser's learner summary shows another reader theirs. Prices are in `currency`: the proxy
 * serves each country the page's variant in its own currency (`getBillingCurrency`), a static
 * route each (`pricing/<currency>/page.tsx`); `static-value-routes.test.ts` keeps those folders
 * exactly in step with `BILLING_CURRENCIES`.
 */
export async function PricingPage({ currency }: { currency: string }) {
  const { monthlyPrice, yearlyPrice } = await getPlusPrices(readCurrency(currency));

  return (
    <PublicPage pathname="/pricing">
      <PricingHero />
      <PricingPlans monthlyPrice={monthlyPrice} yearlyPrice={yearlyPrice} />
      <PricingCovers />
      <PricingQuestions />
      <PricingClose hasChoice={Boolean(monthlyPrice && yearlyPrice)} />
    </PublicPage>
  );
}
