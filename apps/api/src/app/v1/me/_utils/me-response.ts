import { type auth } from "@zoonk/core/auth";
import { type Subscription } from "@zoonk/db";
import { serializeDate } from "@zoonk/utils/date";

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
type ActiveSubscription = Subscription | null;

/**
 * Keeps `/v1/me` focused on the profile fields native clients need instead of
 * exposing raw Better Auth session internals such as tokens and IP metadata.
 */
function serializeUser(user: AuthSession["user"]) {
  return {
    createdAt: serializeDate(user.createdAt) ?? "",
    displayUsername: user.displayUsername ?? null,
    email: user.email,
    emailVerified: user.emailVerified,
    id: user.id,
    image: user.image ?? null,
    name: user.name,
    updatedAt: serializeDate(user.updatedAt) ?? "",
    username: user.username ?? null,
  };
}

/**
 * Returns only account-state fields that are useful to clients for gating paid
 * features, leaving provider-specific identifiers and billing internals private.
 */
function serializeSubscription(subscription: ActiveSubscription) {
  if (!subscription) {
    return null;
  }

  return {
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? null,
    id: subscription.id,
    periodEnd: serializeDate(subscription.periodEnd),
    periodStart: serializeDate(subscription.periodStart),
    plan: subscription.plan,
    provider: subscription.provider,
    status: subscription.status ?? null,
  };
}

/**
 * Builds the public `/v1/me` response from the fresh auth session and active
 * subscription lookup so GET and PATCH return the exact same response shape.
 */
export function createMeResponse({
  session,
  subscription,
}: {
  session: AuthSession;
  subscription: ActiveSubscription;
}) {
  return {
    account: {
      hasActiveSubscription: Boolean(subscription),
      subscription: serializeSubscription(subscription),
    },
    user: serializeUser(session.user),
  };
}
