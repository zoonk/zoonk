import {
  PlusPricing,
  PlusPricingPage,
  PlusPricingSkeleton,
  getPlusPricingMetadata,
} from "@/components/pricing/plus-pricing";
import { PublicPage } from "@/components/public/public-page";
import { getPlusPrices } from "@/data/subscriptions/get-plus-prices";
import { getLocalizedAlternates } from "@/lib/metadata/localized-url";
import { type Metadata } from "next";
import { lang } from "next/root-params";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const [language, metadata] = await Promise.all([lang(), getPlusPricingMetadata()]);
  return { ...metadata, alternates: getLocalizedAlternates({ href: "/pricing", language }) };
}

/** Prices depend on the visitor's country, so they stream in under the static headline. */
async function VisitorPlusPricing() {
  const { monthlyPrice, yearlyPrice } = await getPlusPrices();

  return (
    <PlusPricing
      monthlyPrice={monthlyPrice}
      viewerState={{ status: "visitor" }}
      yearlyPrice={yearlyPrice}
    />
  );
}

/**
 * Pricing for visitors, in the public frame, where the next step is starting free. Anyone with a
 * session gets the subscription page in the app instead: the proxy sends them there before this
 * renders.
 */
export default function PricingPage() {
  return (
    <PublicPage>
      <PlusPricingPage className="mx-auto max-w-150" render={<div />}>
        <Suspense fallback={<PlusPricingSkeleton />}>
          <VisitorPlusPricing />
        </Suspense>
      </PlusPricingPage>
    </PublicPage>
  );
}
