import "server-only";
import { getSession } from "../users/get-session";
import { findReachedUsageLimit } from "./_utils/reached-usage-limit";
import { type AllowanceLimit } from "./contract";

/**
 * The goal limit a guest already reached, judged by the same rules as creating a goal: their one
 * goal is taken, and only an account adds another. Onboarding checks it before reading new words,
 * so a guest is asked to create an account first instead of after waiting for an understanding
 * they can't confirm. Null for accounts (the free plan's limit can be lifted by pausing a goal)
 * and for guests with room. Uncached: it decides whether new work starts.
 */
export async function findGuestGoalLimit(): Promise<AllowanceLimit | null> {
  const session = await getSession();

  if (!session?.user.isAnonymous) {
    return null;
  }

  return findReachedUsageLimit({ kind: "goal", tier: "guest", userId: session.user.id });
}
