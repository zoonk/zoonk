import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { type MissionPick } from "../../sessions/missions/catalog";
import { type DayProgressQuery, queryDayProgress } from "../../sessions/missions/mission-day-views";
import { readGoalPlan } from "../_utils/read-goal-plan";

async function readProgressRow(
  userId: string,
  goalId: string | null,
  kinds: MissionPick["kind"][],
  from: string,
  to: string,
) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  return queryDayProgress(
    prisma,
    { from: new Date(from), goalId, kinds, to: new Date(to), userId },
    readGoalPlan,
  );
}

/** GET-only: the day's mission counts, read once per request for the learner summary and the day. */
export function readDayMissionProgress({ from, goalId, kinds, to, userId }: DayProgressQuery) {
  return readProgressRow(userId, goalId, [...kinds], from.toISOString(), to.toISOString());
}
