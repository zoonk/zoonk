import { SectionPageHeader } from "@/components/learn/section-page";
import { BILLING_PERIOD_PARAM, readBillingPeriod } from "@/components/pricing/plus-plan";
import { PlusPricing } from "@/components/pricing/plus-pricing";
import { getCurrentPlusSubscription } from "@/data/subscriptions/get-current-plus-subscription";
import { getPlusPrices } from "@/data/subscriptions/get-plus-prices";
import { getRequestBillingCurrency } from "@/data/subscriptions/get-request-billing-currency";
import { getWebPlusSubscription } from "@zoonk/core/subscriptions/get-web-plus-subscription";
import { getSession } from "@zoonk/core/users/session";
import { Page, PageSection, PageSectionTitle, PageSubtitle } from "@zoonk/learn/page";
import { getExtracted } from "next-intl/server";
import { CancelPlusButton } from "./cancel-plus-button";
import { CurrentPlan } from "./current-plan";
import { StripeCheckoutConfirming } from "./stripe-checkout-confirming";
import { StripeCheckoutReturn } from "./stripe-checkout-return";

function getOfferViewer({ hasAccount, hasSession }: { hasAccount: boolean; hasSession: boolean }) {
  if (!hasSession) {
    return "visitor";
  }

  return hasAccount ? "free" : "guest";
}

export async function SubscriptionPlans({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/subscription">["searchParams"];
}) {
  const t = await getExtracted();

  const [query, session, subscription, webSubscription, prices] = await Promise.all([
    searchParams,
    getSession(),
    getCurrentPlusSubscription(),
    getWebPlusSubscription(),
    getRequestBillingCurrency().then((currency) => getPlusPrices(currency)),
  ]);

  const stripeCheckoutCompleted = query.stripe_checkout === "complete";

  if (subscription) {
    return (
      <>
        <StripeCheckoutReturn stripeCheckoutCompleted={stripeCheckoutCompleted} />
        <CurrentPlan subscription={subscription} webSubscription={webSubscription} />
      </>
    );
  }

  // Guests have a session too, but need an account before they can subscribe.
  const hasAccount = Boolean(session && !session.user.isAnonymous);

  // Back from Stripe before its webhook saved the subscription: never the offer they just paid for.
  if (stripeCheckoutCompleted && hasAccount) {
    return <StripeCheckoutConfirming />;
  }

  if (webSubscription?.status === "ready" && webSubscription.state === "unpaid") {
    return (
      <Page className="max-w-form">
        <SectionPageHeader title={t("Subscription")} />

        <PageSection>
          <div className="flex flex-col gap-1">
            <PageSectionTitle>{t("Plus")}</PageSectionTitle>
            <PageSubtitle>{t("Your last renewal payment failed.")}</PageSubtitle>
          </div>
        </PageSection>
        <CancelPlusButton endsNow />
      </Page>
    );
  }

  return (
    <Page>
      <SectionPageHeader title={t("Subscription")} />

      <PlusPricing
        defaultPeriod={readBillingPeriod(query[BILLING_PERIOD_PARAM])}
        monthlyPrice={prices.monthlyPrice}
        viewerState={{ status: getOfferViewer({ hasAccount, hasSession: Boolean(session) }) }}
        yearlyPrice={prices.yearlyPrice}
      />
    </Page>
  );
}
