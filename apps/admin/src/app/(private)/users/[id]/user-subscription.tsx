import { AdminSection } from "@/components/admin-section";
import { StateMark } from "@/components/state-mark";
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
import { CreditCardIcon } from "lucide-react";
import { ChangePlanButton } from "./change-plan-button";

type UserSubscriptions = Awaited<ReturnType<typeof getUserSubscriptions>>;
type ActiveSubscription = NonNullable<UserSubscriptions["active"]>;

/** Better Auth schedules a cancellation by timestamp or at the period end, so both count. */
function getCancellationDate(subscription: ActiveSubscription) {
  if (!subscription.cancelAt && !subscription.cancelAtPeriodEnd) {
    return null;
  }

  return subscription.cancelAt ?? subscription.periodEnd;
}

function ActiveFacts({ subscription }: { subscription: ActiveSubscription }) {
  const cancels = getCancellationDate(subscription);
  const store = getSubscriptionStore(subscription.provider);

  const facts = [
    getSubscriptionBilledBy(subscription),
    subscription.periodStart && `Since ${formatDate(subscription.periodStart)}`,
    !cancels &&
      subscription.periodEnd &&
      `${store ? "Renews" : "Ends"} ${formatDate(subscription.periodEnd)}`,
  ];

  return (
    <>
      <span>{facts.filter(Boolean).join(" · ")}</span>
      {cancels ? (
        <StateMark state="canceled" tone="attention">
          Cancels {formatDate(cancels)}
        </StateMark>
      ) : null}
      {store ? <span>Change it in {store.where}.</span> : null}
      {subscription.stripeCustomerId ? (
        <span className="font-mono text-xs">{subscription.stripeCustomerId}</span>
      ) : null}
    </>
  );
}

/** What they pay for, in a few lines: the plan, who bills it and until when. */
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
      title="Subscription"
    >
      <div className="flex items-start gap-2.5">
        <CreditCardIcon
          aria-hidden="true"
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
        />
        <div className="text-muted-foreground text-compact flex min-w-0 flex-col gap-1">
          <span className="text-foreground flex flex-wrap items-center gap-x-3 text-sm font-medium">
            {getPlanLabel(active?.plan)}
            {active && active.status !== "active" ? (
              <StateMark className="font-normal" state={active.status ?? "incomplete"}>
                {getSubscriptionStatusLabel(active.status)}
              </StateMark>
            ) : null}
          </span>

          {active ? <ActiveFacts subscription={active} /> : null}

          {incomplete ? (
            <span>Unfinished checkout: {getPlanLabel(incomplete.plan)}, started and not paid</span>
          ) : null}

          {canceled ? (
            <span>
              Last canceled: {getPlanLabel(canceled.plan)}
              {canceled.canceledAt ? `, ${formatDate(canceled.canceledAt)}` : ""}
            </span>
          ) : null}

          {active || canceled || incomplete ? null : <span>They never had a subscription.</span>}
        </div>
      </div>
    </AdminSection>
  );
}
