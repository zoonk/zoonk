import { PlusPricing, PlusPricingPage } from "@/components/pricing/plus-pricing";
import { type PlusViewerState } from "@/components/pricing/plus-purchase";
import { getPlusPrices } from "@/data/subscriptions/get-plus-prices";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getLearnerProtections } from "@zoonk/core/minors/protections";
import { getSession } from "@zoonk/core/users/session";
import { type Subscription } from "@zoonk/db";
import { PLUS_PLAN } from "@zoonk/utils/subscription";
import { CurrentPlan } from "./current-plan";
import { StripeCheckoutConfirming } from "./stripe-checkout-confirming";
import { StripeCheckoutReturn } from "./stripe-checkout-return";

/**
 * Subscribers see their plan: what it includes, when it renews and where to manage it. Everyone
 * else sees the offer, with the action their account allows, about the goal they're working on.
 */
export async function SubscriptionPlans({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/subscription">["searchParams"];
}) {
  const [query, session, subscription, prices, protections, goal] = await Promise.all([
    searchParams,
    getSession(),
    getCurrentPlusSubscription(),
    getPlusPrices(),
    getLearnerProtections(),
    getCurrentGoal(),
  ]);

  const stripeCheckoutCompleted = query.stripe_checkout === "complete";

  if (subscription) {
    return (
      <>
        <StripeCheckoutReturn stripeCheckoutCompleted={stripeCheckoutCompleted} />
        <CurrentPlan subscription={subscription} />
      </>
    );
  }

  // Guests have a session too, but need an account before they can subscribe.
  const hasAccount = Boolean(session && !session.user.isAnonymous);

  // Back from Stripe before its webhook saved the subscription: never the offer they just paid for.
  if (stripeCheckoutCompleted && hasAccount) {
    return <StripeCheckoutConfirming />;
  }

  const viewerState = getPlusViewerState({
    isAuthenticated: hasAccount,
    needsGuardian: protections?.plusPurchase === "needsGuardianApproval",
  });

  return (
    <PlusPricingPage className="sm:max-w-150" goalTitle={goal?.title}>
      <PlusPricing
        monthlyPrice={prices.monthlyPrice}
        viewerState={viewerState}
        yearlyPrice={prices.yearlyPrice}
      />
    </PlusPricingPage>
  );
}

/** Who sees the offer inside the app: a learner with an account, one under 18, or a guest. */
function getPlusViewerState({
  isAuthenticated,
  needsGuardian,
}: {
  isAuthenticated: boolean;
  /** A learner under 18 whose guardian hasn't approved Plus yet. */
  needsGuardian: boolean;
}): PlusViewerState {
  if (isAuthenticated && needsGuardian) {
    return { status: "guardian" };
  }

  if (isAuthenticated) {
    return { status: "free" };
  }

  return { status: "guest" };
}

/**
 * The shared account capability already returns the complete active billing
 * resource, so this UI helper only narrows it to Plus, the sole paid plan.
 */
async function getCurrentPlusSubscription(): Promise<Subscription | null> {
  const activeSubscription = await getActiveSubscription();

  if (activeSubscription?.plan !== PLUS_PLAN.name) {
    return null;
  }

  return activeSubscription;
}
