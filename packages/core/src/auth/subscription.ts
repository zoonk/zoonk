import { auth } from "@zoonk/auth";
import { findActiveSubscription } from "@zoonk/auth/subscription";
import { safeAsync } from "@zoonk/utils/error";

export { findActiveSubscription, isActiveSubscription } from "@zoonk/auth/subscription";

async function getActiveSubscription(headers: Headers) {
  const { data } = await safeAsync(() => auth.api.listActiveSubscriptions({ headers }));
  return findActiveSubscription(data);
}

export async function hasActiveSubscription(headers: Headers) {
  const subscription = await getActiveSubscription(headers);
  return Boolean(subscription);
}
