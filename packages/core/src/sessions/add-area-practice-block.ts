import "server-only";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { type TargetedPracticeResult, addTargetedPracticeBlock } from "./_utils/targeted-practice";
import { type AreaPracticeInput } from "./contract";

export type AreaPracticeResult =
  | TargetedPracticeResult
  | { status: "goalNotActive" | "notFound" | "unauthorized" };

/**
 * "Practice now" on an area in Progress (or a chapter's page): a bonus block of practice on that
 * area's studied skills (or its next lesson when nothing is left to practice), added to today's
 * session. It can start before the day's session is done, but it counts as extra time like
 * "10 more minutes": at most two bonus blocks a day, never past a guardian's limit, and its
 * Brain Power is capped. A second tap opens the area's unfinished block.
 */
export async function addAreaPracticeBlock({
  goalId,
  input,
}: {
  goalId: string;
  input: AreaPracticeInput;
}): Promise<AreaPracticeResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (owned.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const plan = await loadGoalPlan(goalId);
  const areaSkills = plan.skills.filter((skill) => skill.areaId === input.areaId);
  const title = areaSkills[0]?.areaTitle;

  if (!title) {
    return { status: "notFound" };
  }

  const skillIds = new Set(areaSkills.map((skill) => skill.id));

  const planItemIds = plan.items
    .filter((item) => item.skillIds.some((skillId) => skillIds.has(skillId)))
    .map((item) => item.id);

  return addTargetedPracticeBlock({
    goal: owned.goal,
    target: { areaId: input.areaId, planItemIds, skillIds: [...skillIds], title },
    timeZone: input.timeZone,
    userId: owned.userId,
  });
}
