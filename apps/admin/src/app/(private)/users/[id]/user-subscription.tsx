import { getUserSubscription } from "@/data/users/get-user-subscription";
import { Separator } from "@zoonk/ui/components/separator";
import { ChangePlanDialog } from "./change-plan-dialog";
import { DetailField } from "./detail-field";

export async function UserSubscription({ userId }: { userId: number }) {
  const subscription = await getUserSubscription(userId);
  const isStripeManaged = Boolean(subscription?.stripeSubscriptionId);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Subscription</h3>
        {!isStripeManaged && (
          <ChangePlanDialog userId={userId} currentPlan={subscription?.plan ?? "free"} />
        )}
      </div>

      <Separator />

      <dl className="mt-2">
        <DetailField label="Plan">
          <span className="capitalize">{subscription?.plan ?? "Free"}</span>
        </DetailField>

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
