import "server-only";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { type TargetedPracticeResult, addTargetedPracticeBlock } from "./_utils/targeted-practice";
import { type AreaPracticeInput } from "./contract";

export type AreaPracticeResult =
  | TargetedPracticeResult
  | { status: "goalNotActive" | "notFound" | "unauthorized" };

/** Adds capped extra practice before or after the planned day; repeated taps reuse the area's unfinished block. */
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
    target: { areaId: input.areaId, planItemIds, refresh: false, skillIds: [...skillIds], title },
    timeZone: input.timeZone,
    userId: owned.userId,
  });
}
