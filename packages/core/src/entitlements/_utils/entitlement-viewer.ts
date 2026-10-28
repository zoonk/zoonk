import "server-only";
import { hasActiveSubscription } from "../../auth/subscription";
import { readActiveSubscription } from "../../learner/facts/subscription";
import { getSession } from "../../users/get-session";
import { type EntitlementTier } from "../contract";

export type EntitlementViewer = { isGuest: boolean; tier: EntitlementTier; userId: string };

/** Uses a fresh subscription check; callers cannot select the viewer. */
export async function getEntitlementViewer(): Promise<EntitlementViewer | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  if (session.user.isAnonymous) {
    return { isGuest: true, tier: "guest", userId };
  }

  const tier = (await hasActiveSubscription()) ? "plus" : "free";

  return { isGuest: false, tier, userId };
}

/** Display reads only; writes and workflow starts must use the fresh getEntitlementViewer check. */
export async function readEntitlementViewer(): Promise<EntitlementViewer | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  if (session.user.isAnonymous) {
    return { isGuest: true, tier: "guest", userId };
  }

  const tier = (await readActiveSubscription(userId)) ? "plus" : "free";

  return { isGuest: false, tier, userId };
}
