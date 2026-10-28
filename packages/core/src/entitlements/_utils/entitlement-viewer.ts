import "server-only";
import { hasActiveSubscription } from "../../auth/subscription";
import { readActiveSubscription } from "../../learner/facts/subscription";
import { getSession } from "../../users/get-session";
import { type EntitlementTier } from "../contract";

export type EntitlementViewer = { isGuest: boolean; tier: EntitlementTier; userId: string };

/** Derives the plan from the session and a fresh subscription check, never from the caller. */
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

/**
 * The viewer a page shows, from the request's subscription fact (`readActiveSubscription`), so a
 * render reads the subscription once. Writes and workflow starts use `getEntitlementViewer`, which
 * checks it fresh.
 */
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
