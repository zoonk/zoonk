import "server-only";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { type TodayLearnBlock } from "../../plans/_utils/up-next-item";
import { loadTodayLearnBlocks } from "../../view-models/_utils/today-lesson-order";
import { readOwnedGoal } from "./owned-goal";

/** GET-only fact after ownership authorization; writes call `loadTodayLearnBlocks`. */
export async function readTodayLearnBlocks(
  userId: string,
  goalId: string,
): Promise<TodayLearnBlock[]> {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  const goal = await readOwnedGoal(userId, goalId);
  return goal ? loadTodayLearnBlocks(goal) : [];
}
