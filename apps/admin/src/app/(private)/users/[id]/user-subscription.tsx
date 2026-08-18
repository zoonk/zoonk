import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { getUserSubscriptions } from "@/data/users/get-user-subscriptions";
import { getSubscriptionProviderLabel, getSubscriptionStatusLabel } from "@/lib/subscription";
import { Badge } from "@zoonk/ui/components/badge";
import { Separator } from "@zoonk/ui/components/separator";
import { ChangePlanDialog } from "./change-plan-dialog";
import { DetailField } from "./detail-field";

type UserSubscriptions = Awaited<ReturnType<typeof getUserSubscriptions>>;
type UserSubscriptionRecord = NonNullable<UserSubscriptions["active"]>;

export async function UserSubscription({ userId }: { userId: string }) {
  "use cache: private";

  const subscriptions = await getUserSubscriptions(userId);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Subscription</h3>
        {canChangeSubscriptionPlan(subscriptions.active) && (
          <ChangePlanDialog
            userId={userId}
            currentPlan={getCurrentSubscriptionPlan(subscriptions.active)}
          />
        )}
      </div>

      <Separator />

      <UserSubscriptionDetails subscriptions={subscriptions} />
    </section>
  );
}

function UserSubscriptionDetails({ subscriptions }: { subscriptions: UserSubscriptions }) {
  const subscription = subscriptions.active;

  return (
    <dl className="mt-2">
      <DetailField label="Plan">
        <span className="capitalize">{subscription?.plan ?? "Free"}</span>
      </DetailField>
      <SubscriptionProviderField subscription={subscription} />
      <SubscriptionStatusField subscription={subscription} />
      <SubscriptionBillingField subscription={subscription} />
      <CurrentSubscriptionPeriodField subscription={subscriptions.active} />
      <ScheduledCancellationField subscription={subscriptions.active} />
      <IncompleteCheckoutField subscription={subscriptions.incomplete} />
      <LastCancellationField subscription={subscriptions.canceled} />
      <StripeCustomerField subscription={subscription} />
    </dl>
  );
}

function SubscriptionProviderField({
  subscription,
}: {
  subscription: UserSubscriptionRecord | null;
}) {
  return (
    <DetailField label="Provider">
      {subscription ? getSubscriptionProviderLabel(subscription.provider) : "—"}
    </DetailField>
  );
}

function SubscriptionStatusField({
  subscription,
}: {
  subscription: UserSubscriptionRecord | null;
}) {
  if (!subscription) {
    return <DetailField label="Status">—</DetailField>;
  }

  return (
    <DetailField label="Status">
      <SubscriptionStatusBadge className="capitalize" status={subscription.status}>
        {getSubscriptionStatusLabel(subscription.status)}
      </SubscriptionStatusBadge>
    </DetailField>
  );
}

function SubscriptionBillingField({
  subscription,
}: {
  subscription: UserSubscriptionRecord | null;
}) {
  if (!subscription?.billingInterval) {
    return null;
  }

  return (
    <DetailField label="Billing">
      <span className="capitalize">{subscription.billingInterval}</span>
    </DetailField>
  );
}

function CurrentSubscriptionPeriodField({
  subscription,
}: {
  subscription: UserSubscriptionRecord | null;
}) {
  if (!subscription?.periodStart || !subscription.periodEnd) {
    return null;
  }

  return (
    <DetailField label="Current period">
      {formatDate(subscription.periodStart)} – {formatDate(subscription.periodEnd)}
    </DetailField>
  );
}

function ScheduledCancellationField({
  subscription,
}: {
  subscription: UserSubscriptionRecord | null;
}) {
  const scheduledCancellation = getScheduledCancellation(subscription);

  if (!scheduledCancellation) {
    return null;
  }

  return (
    <DetailField label="Scheduled cancellation">
      <span className="flex items-center gap-2">
        <Badge variant="secondary">Scheduled</Badge>
        {scheduledCancellation.date
          ? formatDate(scheduledCancellation.date)
          : "End of current period"}
      </span>
    </DetailField>
  );
}

function IncompleteCheckoutField({
  subscription,
}: {
  subscription: UserSubscriptionRecord | null;
}) {
  if (!subscription) {
    return null;
  }

  return (
    <DetailField label="Incomplete checkout">
      <span className="flex items-center gap-2">
        <SubscriptionStatusBadge status={subscription.status}>Incomplete</SubscriptionStatusBadge>
        <span className="capitalize">{subscription.plan}</span>
      </span>
    </DetailField>
  );
}

function LastCancellationField({ subscription }: { subscription: UserSubscriptionRecord | null }) {
  if (!subscription) {
    return null;
  }

  return (
    <DetailField label="Last cancellation">
      <span className="flex items-center gap-2">
        <SubscriptionStatusBadge status={subscription.status}>Canceled</SubscriptionStatusBadge>
        {subscription.canceledAt ? formatDate(subscription.canceledAt) : "Date unavailable"}
      </span>
    </DetailField>
  );
}

function StripeCustomerField({ subscription }: { subscription: UserSubscriptionRecord | null }) {
  if (!subscription?.stripeCustomerId) {
    return null;
  }

  return <DetailField label="Stripe customer">{subscription.stripeCustomerId}</DetailField>;
}

function canChangeSubscriptionPlan(subscription: UserSubscriptionRecord | null) {
  return !subscription || subscription.provider === "zoonk";
}

function getCurrentSubscriptionPlan(subscription: UserSubscriptionRecord | null) {
  return subscription?.plan ?? "free";
}

/**
 * Better Auth can schedule cancellation with an explicit timestamp or with the
 * current period end, so both fields participate in the admin lifecycle signal.
 */
function getScheduledCancellation(subscription: UserSubscriptionRecord | null) {
  if (!subscription?.cancelAt && !subscription?.cancelAtPeriodEnd) {
    return null;
  }

  return { date: subscription.cancelAt ?? subscription.periodEnd };
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString();
}
