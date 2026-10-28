import "server-only";
import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { findPlanFirstLessonId } from "../../plans/_utils/plan-first-lesson";
import { replanAfterPlacement } from "../../plans/replan-after-placement";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../_utils/write-learner-change";
import { applyPlacement } from "./_utils/apply-placement";
import { type PlacementCompletionInput } from "./placement-contract";
import {
  type AreaStart,
  type PhaseStart,
  getScratchAreaStarts,
  getScratchPhaseStarts,
} from "./placement-steps";

type PlacementCompletion = {
  areas: AreaStart[];
  /** False when the plan has no skills. */
  complete: boolean;
  knownSkillIds: string[];
  phases: PhaseStart[];
  testedOutPlanItemIds: string[];
};

export type FinishPlacementResult =
  | {
      completion: PlacementCompletion;
      /** Null while the first item stands in for an unoutlined skill. */
      firstLessonId: string | null;
      status: "ready";
    }
  | { status: "notFound" }
  | { status: "unauthorized" };

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

/** May stop before placement settles; starting from scratch also disables first-week placement questions. */
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

  const plan = await loadPlacementPlan(goalId);

  if (input.fromScratch) {
    const [firstLessonId] = await Promise.all([
      findPlanFirstLessonId(goalId),
      declinePlacement(owned.goal),
    ]);

    return {
      completion: {
        areas: getScratchAreaStarts(plan.skills),
        complete: plan.skills.length > 0,
        knownSkillIds: [],
        phases: getScratchPhaseStarts(plan.skills),
        testedOutPlanItemIds: [],
      },
      firstLessonId,
      status: "ready",
    };
  }

  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  const { changeId, pastBasicsAreas, state, testedOutPlanItemIds } = await applyPlacement({
    goalId,
    now,
    plan,
    timeZone,
    userId: owned.userId,
  });

  if (!changeId) {
    await replanAfterPlacement({ goalId, now, pastBasicsAreas, timeZone });
  }

  return {
    completion: {
      areas: state.areas,
      complete: state.complete,
      knownSkillIds: state.knownSkillIds,
      phases: state.phases,
      testedOutPlanItemIds,
    },
    firstLessonId: await findPlanFirstLessonId(goalId),
    status: "ready",
  };
}
