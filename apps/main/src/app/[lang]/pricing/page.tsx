import { PricingPage, getPricingPageMetadata } from "@/components/pricing/pricing-page";
import { DEFAULT_CURRENCY } from "@zoonk/utils/currency";
import { type Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return getPricingPageMetadata();
}

/** The pricing page in the default currency; the proxy serves other countries their variant. */
export default function Pricing() {
  return <PricingPage currency={Promise.resolve(DEFAULT_CURRENCY)} />;
}
