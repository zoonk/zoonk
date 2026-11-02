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

function readCurrency(currency: string): string {
  return BILLING_CURRENCIES.includes(currency) ? currency : DEFAULT_CURRENCY;
}

/**
 * Static: its HTML is a visitor's, and the browser's learner summary shows another reader theirs.
 * Each currency is a static route that the proxy serves (`static-value-routes.test.ts`).
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
