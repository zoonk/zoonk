import "server-only";
import { cacheLife } from "next/cache";
import { readActiveGoal } from "../learner/facts/learning-profile";
import { getSession } from "../users/get-session";

/** The owned stored selection, or the earliest active goal only while none is selected. */
export async function getActiveGoalId(): Promise<string | null> {
  "use cache: private";

  cacheLife({ stale: Infinity });

  const session = await getSession();

  const goal = session ? await readActiveGoal(session.user.id) : null;

  return goal?.id ?? null;
}
