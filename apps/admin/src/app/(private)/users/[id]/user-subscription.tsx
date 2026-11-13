import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getUser } from "@/data/users/get-user";
import { getUserSubscriptions } from "@/data/users/get-user-subscriptions";
import { formatDate } from "@/lib/format";
import { getLearnerLabel } from "@/lib/learner-label";
import {
  getPlanLabel,
  getSubscriptionBilledBy,
  getSubscriptionStatusLabel,
  getSubscriptionStore,
} from "@/lib/subscription";
import { ChangePlanButton } from "./change-plan-button";

type UserSubscriptions = Awaited<ReturnType<typeof getUserSubscriptions>>;

/** Better Auth schedules a cancellation by timestamp or at the period end, so both count. */
function getCancellationDate(subscription: NonNullable<UserSubscriptions["active"]>) {
  if (!subscription.cancelAt && !subscription.cancelAtPeriodEnd) {
    return null;
  }

  return subscription.cancelAt ?? subscription.periodEnd;
}

function ActiveSubscriptionFields({
  subscription,
}: {
  subscription: NonNullable<UserSubscriptions["active"]>;
}) {
  const cancels = getCancellationDate(subscription);

  return (
    <>
      <DetailField label="Billed by">{getSubscriptionBilledBy(subscription)}</DetailField>

      {subscription.status === "active" ? null : (
        <DetailField label="State">{getSubscriptionStatusLabel(subscription.status)}</DetailField>
      )}

      {subscription.periodStart ? (
        <DetailField label="Since">{formatDate(subscription.periodStart)}</DetailField>
      ) : null}

      {cancels ? (
        <DetailField label="Cancels on">
          <span className="text-warning-text">{formatDate(cancels)}</span>
        </DetailField>
      ) : null}

      {!cancels && subscription.periodEnd ? (
        <DetailField label={getSubscriptionStore(subscription.provider) ? "Renews on" : "Ends on"}>
          {formatDate(subscription.periodEnd)}
        </DetailField>
      ) : null}

      {subscription.stripeCustomerId ? (
        <DetailField label="Stripe customer">
          <span className="font-mono text-xs">{subscription.stripeCustomerId}</span>
        </DetailField>
      ) : null}
    </>
  );
}

export async function UserSubscription({ userId }: { userId: string }) {
  "use cache: private";

  const [user, { active, canceled, incomplete }] = await Promise.all([
    getUser(userId),
    getUserSubscriptions(userId),
  ]);

  if (!user) {
    return null;
  }

  const store = active ? getSubscriptionStore(active.provider) : null;

  return (
    <AdminSection
      action={
        store ? null : (
          <ChangePlanButton
            hasPlus={Boolean(active)}
            userId={userId}
            userName={getLearnerLabel(user)}
          />
        )
      }
      description={store ? `Billed by ${store.name}. Change it in ${store.where}.` : undefined}
      title="Subscription"
    >
      {active || canceled || incomplete ? (
        <DetailFields>
          <DetailField label="Plan">{getPlanLabel(active?.plan)}</DetailField>

          {active ? <ActiveSubscriptionFields subscription={active} /> : null}

          {incomplete ? (
            <DetailField label="Unfinished checkout">
              {getPlanLabel(incomplete.plan)}, started and not paid
            </DetailField>
          ) : null}

          {canceled ? (
            <DetailField label="Last canceled">
              {getPlanLabel(canceled.plan)}
              {canceled.canceledAt ? `, ${formatDate(canceled.canceledAt)}` : ""}
            </DetailField>
          ) : null}
        </DetailFields>
      ) : (
        <AdminSectionEmpty>Free. They never had a subscription.</AdminSectionEmpty>
      )}
    </AdminSection>
  );
}
