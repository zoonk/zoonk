import "server-only";
import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../../cache/tags";
import { type GoalPlan, loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../../_utils/known-skills";
import { getAnswerTimeZone } from "../../_utils/owned-goal";
import { type PlacementState, loadPlacementState } from "./load-placement-state";

/**
 * Applies what placement knows, on every skill of the goal's skill graph: skills it's sure the
 * learner can do become known in the learner model, plan items teaching only known skills are
 * tested out, and known skills the plan's time leaves out get tested-out stand-ins, so no re-plan
 * brings them back; the plan announces all of it with an undo. Returns the placement it applied
 * and the plan items it tested out.
 */
export async function applyPlacement({
  goalId,
  now,
  plan,
  timeZone,
  userId,
}: {
  goalId: string;
  now: Date;
  plan?: GoalPlan;
  timeZone: string;
  userId: string;
}): Promise<{ state: PlacementState; testedOutPlanItemIds: string[] }> {
  const goalPlan = plan ?? (await loadPlacementPlan(goalId));
  const state = await loadPlacementState({ goalId, plan: goalPlan, userId });

  await markSkillsKnown({ knownAt: now, skillIds: state.knownSkillIds, timeZone, userId });

  const { planItemIds: testedOutPlanItemIds } = await markPlanItemsTestedOut({
    goalId,
    items: goalPlan.items,
    knownSkillIds: new Set(state.knownSkillIds),
    placedSkills: goalPlan.skills,
    testedOutAt: now,
    timeZone,
  });

  revalidateCacheTags([getLearnerModelCacheTag(userId)]);

  return { state, testedOutPlanItemIds };
}

/**
 * Applies placement to a goal's plan the moment it's first built, when the learner already ended
 * placement (or a language goal's level test) before the plan existed: what their level and
 * answers settled is tested out right away, so day one starts past it.
 */
export async function applyPlacementToNewPlan(goal: Goal): Promise<void> {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const answered = Array.isArray(details.answered) ? details.answered : [];

  if (!answered.includes("placement") || details.placementDeclined === true) {
    return;
  }

  await applyPlacement({
    goalId: goal.id,
    now: new Date(),
    timeZone: getAnswerTimeZone({ goal }),
    userId: goal.userId,
  });
}
