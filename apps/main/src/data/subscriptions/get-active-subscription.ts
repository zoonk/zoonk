import "server-only";
import { getActiveSubscription as queryActiveSubscription } from "@zoonk/core/auth/subscription";
import { headers } from "next/headers";

/**
 * Subscription state depends on the current request, so the main app owns a
 * browser-only cache that can participate in runtime prefetching without
 * storing one learner's billing state in the shared server cache.
 */
export async function getActiveSubscription() {
  "use cache: private";

  return queryActiveSubscription(await headers());
}

/**
 * Subscription gates only need a boolean, so they reuse the canonical private
 * subscription lookup instead of creating a second cache scope.
 */
export async function hasActiveSubscription() {
  return Boolean(await getActiveSubscription());
}
