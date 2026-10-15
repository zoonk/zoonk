import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../cache/tags";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getRequestInstant } from "../learner/facts/request-instant";
import { getOwnedGoal } from "../learner/get-owned-goal";
import { getScopeSkillIds } from "./_utils/mistake-scope";
import { type MistakeAvailability } from "./contract";
import { loadMistakeAvailability } from "./mistake-availability";

async function loadGoalScope(goalId: string) {
  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  cacheTag(getLearnerModelCacheTag(owned.userId));
  const skillIds = await getScopeSkillIds({ goalId });

  return { ...owned, skillIds };
}

type ScopeFailure = Exclude<Awaited<ReturnType<typeof loadGoalScope>>, { status: "ready" }>;

type GoalMistakeAvailabilityResult =
  | ScopeFailure
  | { availability: MistakeAvailability; status: "ready" };

/** Exact actionable notebook counts, including per-item listening, audience and survivor rules. */
export async function countGoalMistakes(input: {
  goalId: string;
  timeZone?: string;
}): Promise<GoalMistakeAvailabilityResult> {
  "use cache: private";

  const scope = await loadGoalScope(input.goalId);

  if (scope.status !== "ready") {
    return scope;
  }

  const timeZone = getAnswerTimeZone({ goal: scope.goal, timeZone: input.timeZone });
  const now = await getRequestInstant();

  const availability = await loadMistakeAvailability({
    goal: scope.goal,
    goalId: scope.goal.id,
    localDate: getDateInTimeZone({ date: now, timeZone }),
    skillIds: scope.skillIds,
    timeZone,
    userId: scope.userId,
  });

  return { availability, status: "ready" };
}

/** All open notebook entries in the goal, whether or not their practice is available. */
export async function countOpenGoalMistakes(input: {
  goalId: string;
}): Promise<ScopeFailure | { open: number; status: "ready" }> {
  "use cache: private";

  const scope = await loadGoalScope(input.goalId);

  if (scope.status !== "ready") {
    return scope;
  }

  const open = await prisma.mistake.count({
    where: {
      status: "open",
      userId: scope.userId,
      ...(scope.skillIds ? { skillId: { in: scope.skillIds } } : {}),
    },
  });

  return { open, status: "ready" };
}
