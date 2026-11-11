import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { toIdKey } from "../../library/_utils/shared-rows";
import { readExamBlueprint } from "../../library/exams/read-exam-blueprint";
import { planDayBlocks } from "../../sessions/_utils/plan-study-day";
import { readSavedDayPlan } from "../../sessions/_utils/saved-day-plan";
import { readClaimEvents } from "./claim-events";
import { readOwnedGoal } from "./owned-goal";
import { getRequestInstant } from "./request-instant";
import { readSavedPlan } from "./saved-plan";
import { readActiveSubscription } from "./subscription";

/** GET-only, after ownership authorization; Today and its readers share the unbuilt day's selection and blocks. */
export async function readPlannedDay(userId: string, goalId: string, timeZone: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  const [goal, now, saved] = await Promise.all([
    readOwnedGoal(userId, goalId),
    getRequestInstant(),
    readSavedPlan(userId, goalId),
  ]);

  if (!goal) {
    return null;
  }

  const selection = await readSavedDayPlan({ goal, now, saved, timeZone });

  if (!selection) {
    return null;
  }

  const day = await planDayBlocks({
    blueprint: goal.examBlueprintId ? await readExamBlueprint(goal.examBlueprintId) : null,
    goal,
    localDate: getDateInTimeZone({ date: now, timeZone }),
    now,
    readClaims: (skillIds: readonly string[]) => readClaimEvents(userId, goalId, toIdKey(skillIds)),
    readSubscription: readActiveSubscription,
    selection,
    timeZone,
    userId,
  });

  return { day, selection };
}
