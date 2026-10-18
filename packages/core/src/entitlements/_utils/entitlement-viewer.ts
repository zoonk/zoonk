import "server-only";
import { hasActiveSubscription } from "../../auth/subscription";
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
