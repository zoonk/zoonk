import { PricingPage, getPricingPageMetadata } from "@/components/pricing/pricing-page";
import { BILLING_CURRENCIES, DEFAULT_CURRENCY } from "@zoonk/utils/currency";
import { type Metadata } from "next";

export const ensureStatic = "navigation";

export async function generateMetadata(): Promise<Metadata> {
  return getPricingPageMetadata();
}

/** A variant per currency other than the default (`/pricing` itself), each one static. */
export function generateStaticParams() {
  return BILLING_CURRENCIES.filter((currency) => currency !== DEFAULT_CURRENCY).map((currency) => ({
    currency,
  }));
}

/**
 * The pricing page in a currency, which the proxy serves at `/pricing` to visitors billed in it,
 * so the address never shows the currency and each variant is cached for everyone in it.
 */
export default async function PricingInCurrency({
  params,
}: PageProps<"/[lang]/pricing/[currency]">) {
  const { currency } = await params;
  return <PricingPage currency={currency} />;
}
