import { toApiImageUrl } from "@/lib/file-urls";
import { type CurrentUser } from "@zoonk/core/users/current";
import { type Subscription } from "@zoonk/db";
import { serializeDate } from "@zoonk/utils/date";

type ActiveSubscription = Subscription | null;

/** Picks fields so Better Auth's tokens and IP metadata never reach clients. */
function serializeUser(user: CurrentUser) {
  return {
    analyticsDisabled: user.analyticsDisabled,
    createdAt: serializeDate(user.createdAt) ?? "",
    displayUsername: user.displayUsername ?? null,
    email: user.email,
    emailVerified: user.emailVerified,
    id: user.id,
    image: user.image ? toApiImageUrl(user.image) : null,
    name: user.name,
    updatedAt: serializeDate(user.updatedAt) ?? "",
    username: user.username ?? null,
  };
}

/** Picks fields so provider identifiers and billing internals stay private. */
function serializeSubscription(subscription: ActiveSubscription) {
  if (!subscription) {
    return null;
  }

  return {
    cancelAt: serializeDate(subscription.cancelAt),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? null,
    id: subscription.id,
    periodEnd: serializeDate(subscription.periodEnd),
    periodStart: serializeDate(subscription.periodStart),
    plan: subscription.plan,
    provider: subscription.provider,
    status: subscription.status ?? null,
  };
}

export function createMeResponse({
  hasAppleAccount,
  subscription,
  user,
}: {
  hasAppleAccount: boolean;
  subscription: ActiveSubscription;
  user: CurrentUser;
}) {
  return {
    account: {
      deletion: { hasAppleAccount },
      hasActiveSubscription: Boolean(subscription),
      subscription: serializeSubscription(subscription),
    },
    user: serializeUser(user),
  };
}
