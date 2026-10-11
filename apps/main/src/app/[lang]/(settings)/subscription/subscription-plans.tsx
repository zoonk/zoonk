import { PlusPricing, PlusPricingPage } from "@/components/pricing/plus-pricing";
import { getPlusPrices } from "@/data/subscriptions/get-plus-prices";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getSession } from "@zoonk/core/users/session";
import { type Subscription } from "@zoonk/db";
import { PLUS_PLAN } from "@zoonk/utils/subscription";
import { CurrentPlan } from "./current-plan";
import { StripeCheckoutConfirming } from "./stripe-checkout-confirming";
import { StripeCheckoutReturn } from "./stripe-checkout-return";

/**
 * Subscribers see their plan: what it includes, when it renews and where to manage it. Everyone
 * else sees the offer, with the action their account allows.
 */
export async function SubscriptionPlans({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/subscription">["searchParams"];
}) {
  const [query, session, subscription, prices] = await Promise.all([
    searchParams,
    getSession(),
    getCurrentPlusSubscription(),
    getPlusPrices(),
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

  return (
    <PlusPricingPage render={<div />} variant="settings">
      <PlusPricing
        monthlyPrice={prices.monthlyPrice}
        viewerState={{ status: hasAccount ? "free" : "guest" }}
        yearlyPrice={prices.yearlyPrice}
      />
    </PlusPricingPage>
  );
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
