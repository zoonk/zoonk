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
import { type Metadata } from "next";
import { lang } from "next/root-params";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const [language, metadata] = await Promise.all([lang(), getPlusPricingMetadata()]);
  return { ...metadata, alternates: getLocalizedAlternates({ href: "/pricing", language }) };
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

/**
 * Prices depend on the reader's country and each plan's next step on who they are, so both stream
 * in under the static headline.
 */
async function ViewerPricingPlans() {
  const [{ monthlyPrice, yearlyPrice }, viewerState] = await Promise.all([
    getPlusPrices(),
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
async function VisitorPricingClose() {
  const [session, { monthlyPrice, yearlyPrice }] = await Promise.all([
    getSession(),
    getPlusPrices(),
  ]);

  return session ? null : <PricingClose hasChoice={Boolean(monthlyPrice && yearlyPrice)} />;
}

/**
 * Pricing in the public frame, for everyone: the two plans, then what the free plan covers drawn
 * on a plan's own road, the questions people ask before paying, and, for a visitor, starting free
 * once more. A visitor's next step is starting free or getting Plus, a learner's subscribing, and
 * a subscriber's managing their plan.
 */
export default function PricingPage() {
  return (
    <PublicPage pathname="/pricing">
      <PricingHero />

      <Suspense fallback={<PricingPlansSkeleton />}>
        <ViewerPricingPlans />
      </Suspense>

      <PricingCovers />

      <Suspense fallback={null}>
        <ViewerPricingQuestions />
      </Suspense>

      <Suspense fallback={null}>
        <VisitorPricingClose />
      </Suspense>
    </PublicPage>
  );
}
