import { LearnerWitness } from "@/components/learner/learner-witness";
import { BILLING_PERIOD_PARAM, readBillingPeriod } from "@/components/pricing/plus-plan";
import { PlusPricing } from "@/components/pricing/plus-pricing";
import { getCurrentPlusSubscription } from "@/data/subscriptions/get-current-plus-subscription";
import { getPlusPrices } from "@/data/subscriptions/get-plus-prices";
import { getRequestBillingCurrency } from "@/data/subscriptions/get-request-billing-currency";
import { getAllowance } from "@zoonk/core/entitlements/get-allowance";
import { getSession } from "@zoonk/core/users/session";
import { Page, PageHeader, PageHeaderContent, PageTitle } from "@zoonk/learn/page";
import { getExtracted } from "next-intl/server";
import { CurrentPlan } from "./current-plan";
import { FreePlanSummary } from "./free-plan-summary";
import { StripeCheckoutConfirming } from "./stripe-checkout-confirming";
import { StripeCheckoutReturn } from "./stripe-checkout-return";

/** Whom the offer speaks to: someone without a session starts free or logs in, a guest logs in. */
function getOfferViewer({ hasAccount, hasSession }: { hasAccount: boolean; hasSession: boolean }) {
  if (!hasSession) {
    return "visitor";
  }

  return hasAccount ? "free" : "guest";
}

/**
 * Subscribers see their plan: what it includes, when it renews and where to manage it. Everyone
 * else sees the offer under its plain title, as its sibling settings pages open, with the action
 * their account allows.
 */
export async function SubscriptionPlans({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/subscription">["searchParams"];
}) {
  const t = await getExtracted();

  const [query, session, subscription, prices, allowance] = await Promise.all([
    searchParams,
    getSession(),
    getCurrentPlusSubscription(),
    getRequestBillingCurrency().then((currency) => getPlusPrices(currency)),
    getAllowance(),
  ]);

  const stripeCheckoutCompleted = query.stripe_checkout === "complete";

  if (subscription) {
    return (
      <>
        <LearnerWitness />
        <StripeCheckoutReturn stripeCheckoutCompleted={stripeCheckoutCompleted} />
        <CurrentPlan subscription={subscription} />
      </>
    );
  }

  // Guests have a session too, but need an account before they can subscribe.
  const hasAccount = Boolean(session && !session.user.isAnonymous);

  // Back from Stripe before its webhook saved the subscription: never the offer they just paid for.
  if (stripeCheckoutCompleted && hasAccount) {
    return (
      <>
        <LearnerWitness />
        <StripeCheckoutConfirming />
      </>
    );
  }

  return (
    <Page>
      <LearnerWitness />
      <PageHeader>
        <PageHeaderContent>
          {/* Under the section's title from a tablet up, the offer's name is a step smaller. */}
          <PageTitle className="md:text-xl md:leading-tight">
            {t("Subscribe to Zoonk Plus")}
          </PageTitle>
        </PageHeaderContent>
      </PageHeader>

      {hasAccount && allowance?.tier === "free" && <FreePlanSummary allowance={allowance} />}

      <PlusPricing
        defaultPeriod={readBillingPeriod(query[BILLING_PERIOD_PARAM])}
        monthlyPrice={prices.monthlyPrice}
        viewerState={{ status: getOfferViewer({ hasAccount, hasSession: Boolean(session) }) }}
        yearlyPrice={prices.yearlyPrice}
      />
    </Page>
  );
}
