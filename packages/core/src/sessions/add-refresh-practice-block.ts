import "server-only";
import { prisma } from "@zoonk/db";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { getSkillRetrievability } from "../learner/fsrs-scheduler";
import { isFadingRetrievability } from "../learner/mastery-state";
import { type TargetedPracticeResult, addTargetedPracticeBlock } from "./_utils/targeted-practice";
import { type StudySessionTimeZoneInput } from "./contract";

export type RefreshPracticeResult =
  | TargetedPracticeResult
  | { status: "goalNotActive" | "notFound" | "unauthorized" };

/** Names the refresh block, so a second tap opens the same unfinished block. */
const REFRESH_AREA_ID = "refresh";

async function loadFadingSkillIds({ goalId, userId }: { goalId: string; userId: string }) {
  const skillIds = await loadGoalSkillIds(goalId);
  const now = new Date();

  const studied = await prisma.learnerSkill.findMany({
    where: { reps: { gt: 0 }, skillId: { in: skillIds }, userId },
  });

  return studied
    .filter((row) => isFadingRetrievability(getSkillRetrievability({ memory: row, now })))
    .map((row) => row.skillId);
}

/**
 * "Refresh now" on the map: a bonus block of practice on the goal's fading skills, weakest first,
 * added to today's session and counted as extra time like any bonus block. When today's session
 * already asks every question on them (its reviews), that block opens instead. It's how refresh
 * goals bring back what the learner knew, and anyone can use it. Nothing fading, nothing to do.
 */
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

  const skillIds = await loadFadingSkillIds({ goalId, userId: owned.userId });

  if (skillIds.length === 0) {
    return { status: "nothingToPractice" };
  }

  return addTargetedPracticeBlock({
    goal: owned.goal,
    target: {
      areaId: REFRESH_AREA_ID,
      planItemIds: null,
      reuseSessionBlock: true,
      skillIds,
      title: null,
    },
    timeZone: input.timeZone,
    userId: owned.userId,
  });
}
