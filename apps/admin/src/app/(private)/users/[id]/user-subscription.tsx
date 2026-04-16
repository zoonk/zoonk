import { getUserSubscription } from "@/data/users/get-user-subscription";
import { Separator } from "@zoonk/ui/components/separator";
import { ChangePlanDialog } from "./change-plan-dialog";
import { DetailField } from "./detail-field";

export async function UserSubscription({ userId }: { userId: string }) {
  const subscription = await getUserSubscription(userId);
  const canChangePlan = !subscription || subscription.provider === "zoonk";
  const providerLabel = subscription ? getSubscriptionProviderLabel(subscription.provider) : "—";

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Subscription</h3>
        {canChangePlan && (
          <ChangePlanDialog userId={userId} currentPlan={subscription?.plan ?? "free"} />
        )}
      </div>

      <Separator />

      <dl className="mt-2">
        <DetailField label="Plan">
          <span className="capitalize">{subscription?.plan ?? "Free"}</span>
        </DetailField>

        <DetailField label="Provider">{providerLabel}</DetailField>

        <DetailField label="Status">
          <span className="capitalize">{subscription?.status ?? "—"}</span>
        </DetailField>

        {subscription?.billingInterval && (
          <DetailField label="Billing">
            <span className="capitalize">{subscription.billingInterval}</span>
          </DetailField>
        )}

        {subscription?.periodStart && subscription?.periodEnd && (
          <DetailField label="Current period">
            {new Date(subscription.periodStart).toLocaleDateString()} –{" "}
            {new Date(subscription.periodEnd).toLocaleDateString()}
          </DetailField>
        )}

        {subscription?.stripeCustomerId && (
          <DetailField label="Stripe customer">{subscription.stripeCustomerId}</DetailField>
        )}
      </dl>
    </section>
  );
}

/**
 * Admin users need readable provider labels so they can tell at a glance
 * whether a subscription is managed by Stripe, the app stores, or Zoonk.
 */
function getSubscriptionProviderLabel(provider: string) {
  if (provider === "apple") {
    return "Apple";
  }

  if (provider === "google") {
    return "Google";
  }

  if (provider === "stripe") {
    return "Stripe";
  }

  return "Zoonk";
}
