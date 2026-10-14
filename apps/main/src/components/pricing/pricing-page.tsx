import { type PlusViewerState } from "@/components/pricing/plus-plan";
import {
  PricingClose,
  PricingHero,
  PricingPlans,
  PricingPlansSkeleton,
  PricingQuestions,
  getPlusPricingMetadata,
} from "@/components/pricing/plus-pricing";
import { PricingCovers } from "@/components/pricing/pricing-covers";
import { PublicPage } from "@/components/public/public-page";
import { getCurrentPlusSubscription } from "@/data/subscriptions/get-current-plus-subscription";
import { getPlusPrices } from "@/data/subscriptions/get-plus-prices";
import { getLocalizedAlternates } from "@/lib/metadata/localized-url";
import { getSession } from "@zoonk/core/users/session";
import { BILLING_CURRENCIES, DEFAULT_CURRENCY } from "@zoonk/utils/currency";
import { type Metadata } from "next";
import { lang } from "next/root-params";
import { Suspense } from "react";

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

/** Who's reading: a visitor, a guest, a learner with an account, or a subscriber. */
async function getViewerState(): Promise<PlusViewerState> {
  const [session, subscription] = await Promise.all([getSession(), getCurrentPlusSubscription()]);

  if (!session) {
    return { status: "visitor" };
  }

  if (session.user.isAnonymous) {
    return { status: "guest" };
  }

  return { status: subscription ? "subscribed" : "free" };
}

/** Each plan's next step depends on who's reading, so the plans stream in under the headline. */
async function ViewerPricingPlans({ currency }: { currency: Promise<string> }) {
  const [{ monthlyPrice, yearlyPrice }, viewerState] = await Promise.all([
    currency.then((value) => getPlusPrices(readCurrency(value))),
    getViewerState(),
  ]);

  return (
    <PricingPlans monthlyPrice={monthlyPrice} viewerState={viewerState} yearlyPrice={yearlyPrice} />
  );
}

/** The free plan's answer starts with trying lessons only for someone without an account. */
async function ViewerPricingQuestions() {
  return <PricingQuestions viewerState={await getViewerState()} />;
}

/** The closing call is for visitors; anyone with a session already started. */
async function VisitorPricingClose({ currency }: { currency: Promise<string> }) {
  const [session, { monthlyPrice, yearlyPrice }] = await Promise.all([
    getSession(),
    currency.then((value) => getPlusPrices(readCurrency(value))),
  ]);

  return session ? null : <PricingClose hasChoice={Boolean(monthlyPrice && yearlyPrice)} />;
}

/**
 * Pricing in the public frame, for everyone: the two plans, then what the free plan covers drawn
 * on a plan's own road, the questions people ask before paying, and, for a visitor, starting free
 * once more. A visitor's next step is starting free or getting Plus, a learner's subscribing, and
 * a subscriber's managing their plan. Prices are in `currency`: the proxy serves each country the
 * page's variant in its own currency (`getBillingCurrency`), each one static.
 */
export function PricingPage({ currency }: { currency: Promise<string> }) {
  return (
    <PublicPage pathname="/pricing">
      <PricingHero />

      <Suspense fallback={<PricingPlansSkeleton />}>
        <ViewerPricingPlans currency={currency} />
      </Suspense>

      <PricingCovers />

      <Suspense fallback={null}>
        <ViewerPricingQuestions />
      </Suspense>

      <Suspense fallback={null}>
        <VisitorPricingClose currency={currency} />
      </Suspense>
    </PublicPage>
  );
}
