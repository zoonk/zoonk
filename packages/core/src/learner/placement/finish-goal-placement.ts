import "server-only";
import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { owePlanStartLessons } from "../../follow-ups/owe-goal-lessons";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../_utils/write-learner-change";
import { type PlacementCompletion, completePlacement } from "./_utils/complete-placement";
import { type PlacementCompletionInput } from "./placement-contract";
import { getScratchAreaStarts, getScratchPhaseStarts } from "./placement-steps";

export type FinishPlacementResult =
  | { completion: PlacementCompletion; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

async function declinePlacement(goal: Goal) {
  await writeLearnerChange({ planInputs: true, userId: goal.userId }, async (tx) => {
    const current = await tx.goal.findUnique({ where: { id: goal.id } });
    const details = isJsonObject(current?.details) ? current.details : {};

    if (!current || details.placementDeclined === true) {
      return unchanged(null);
    }

    await tx.goal.update({
      data: { details: { ...details, placementDeclined: true } },
      where: { id: goal.id },
    });
  });
}

/**
 * May stop before placement settles; starting from scratch also disables first-week placement
 * questions. `unavailable`: an exam goal's Focus test has no "from scratch", only "Skip for now",
 * which is a finish with nothing answered.
 */
export async function finishGoalPlacement({
  goalId,
  input,
}: {
  goalId: string;
  input: PlacementCompletionInput;
}): Promise<FinishPlacementResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (input.fromScratch && owned.goal.kind === "exam") {
    return { status: "unavailable" };
  }

  const plan = await loadPlacementPlan(goalId);

  if (input.fromScratch) {
    await declinePlacement(owned.goal);
    await owePlanStartLessons({ goalId, userId: owned.userId });

    return {
      completion: {
        areas: getScratchAreaStarts(plan.skills),
        complete: plan.skills.length > 0,
        focusTest: null,
        knownSkillIds: [],
        phases: getScratchPhaseStarts(plan.skills),
        testedOutPlanItemIds: [],
      },
      status: "ready",
    };
  }

  const completion = await completePlacement({
    goal: owned.goal,
    plan,
    timeZone: getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone }),
  });

  return { completion, status: "ready" };
}
