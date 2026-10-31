import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getSkillRetrievability } from "../learner/fsrs-scheduler";
import { isFadingRetrievability } from "../learner/mastery-state";
import { type TargetedPracticeResult, addTargetedPracticeBlock } from "./_utils/targeted-practice";
import { type StudySessionTimeZoneInput } from "./contract";

export type RefreshPracticeResult =
  | TargetedPracticeResult
  | { status: "goalNotActive" | "notFound" | "unauthorized" };

function getEndOfToday({ goal, timeZone }: { goal: Goal; timeZone?: string }): Date {
  const zone = getAnswerTimeZone({ goal, timeZone });
  const today = getDateInTimeZone({ date: new Date(), timeZone: zone });

  return getStartOfLocalDay({ localDate: new Date(today.getTime() + MS_PER_DAY), timeZone: zone });
}

async function loadReviewSkillIds({ goal, timeZone }: { goal: Goal; timeZone?: string }) {
  const skillIds = await loadGoalSkillIds(goal.id);
  const now = new Date();
  const endOfToday = getEndOfToday({ goal, timeZone });

  const studied = await prisma.learnerSkill.findMany({
    where: { reps: { gt: 0 }, skillId: { in: skillIds }, userId: goal.userId },
  });

  return studied
    .filter(
      (row) =>
        isFadingRetrievability(getSkillRetrievability({ memory: row, now })) ||
        (row.due !== null && row.due.getTime() < endOfToday.getTime()),
    )
    .map((row) => row.skillId);
}

/** Reuses today's covering review block before adding capped extra practice; returns nothing when no skill needs review. */
export async function addRefreshPracticeBlock({
  goalId,
  input,
}: {
  goalId: string;
  input: StudySessionTimeZoneInput;
}): Promise<RefreshPracticeResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (owned.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const skillIds = await loadReviewSkillIds({ goal: owned.goal, timeZone: input.timeZone });

  if (skillIds.length === 0) {
    return { status: "nothingToPractice" };
  }

  return addTargetedPracticeBlock({
    goal: owned.goal,
    target: { areaId: null, planItemIds: null, refresh: true, skillIds, title: null },
    timeZone: input.timeZone,
    userId: owned.userId,
  });
}
