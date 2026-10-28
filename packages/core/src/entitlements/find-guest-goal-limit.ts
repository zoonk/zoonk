import "server-only";
import { getSession } from "../users/get-session";
import { findReachedUsageLimit } from "./_utils/reached-usage-limit";
import { type AllowanceLimit } from "./contract";

/** Fresh check; returns null for accounts and guests with room. */
export async function findGuestGoalLimit(): Promise<AllowanceLimit | null> {
  const session = await getSession();

  if (!session?.user.isAnonymous) {
    return null;
  }

  return findReachedUsageLimit({ kind: "goal", tier: "guest", userId: session.user.id });
}
