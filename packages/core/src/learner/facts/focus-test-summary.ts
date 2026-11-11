import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { loadPlacementWithSummary } from "../placement/_utils/load-placement-state";
import { readFocusSubjects } from "../placement/focus-test-summary";
import { getRequestInstant } from "./request-instant";

/** Current plan subjects and diagnostic answers, after goal ownership authorization. */
export async function readCurrentTestSummary(userId: string, goalId: string) {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const now = await getRequestInstant();
  return loadCurrentTestSummary({ goalId, now, userId });
}

export async function loadCurrentTestSummary({
  userId,
  goalId,
  tx = prisma,
  now = new Date(),
}: {
  userId: string;
  goalId: string;
  tx?: TransactionClient;
  now?: Date;
}) {
  const plan = await loadPlacementPlan(goalId, tx);

  const { focusTest } = await loadPlacementWithSummary({
    goalId,
    now,
    plan,
    today: getDateInTimeZone({ date: now, timeZone: "UTC" }),
    tx,
    userId,
  });

  return focusTest?.summary ?? null;
}

export async function readCurrentFocusSubjects(goal: Pick<Goal, "id" | "kind" | "userId">) {
  return readFocusSubjects(
    goal.kind === "exam" ? await readCurrentTestSummary(goal.userId, goal.id) : null,
  );
}
