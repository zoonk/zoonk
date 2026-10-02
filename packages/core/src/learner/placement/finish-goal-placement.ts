import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { findPlanFirstLessonId } from "../../plans/_utils/plan-first-lesson";
import { loadGoalPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
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
  /**
   * Whether every area of every phase had a confident starting point when placement finished.
   * False when the plan had no skills yet: nothing was placed.
   */
  complete: boolean;
  knownSkillIds: string[];
  phases: PhaseStart[];
  testedOutPlanItemIds: string[];
};

export type FinishPlacementResult =
  | {
      completion: PlacementCompletion;
      /**
       * The lesson the plan now opens with, which Day 1 opens: the apps get it written right away.
       * Null while that item still stands in for a skill whose lessons aren't outlined.
       */
      firstLessonId: string | null;
      status: "ready";
    }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** "Start from scratch" is remembered, so the first week's sessions don't ask placement questions. */
async function declinePlacement(goal: Goal) {
  const details = isJsonObject(goal.details) ? goal.details : {};

  await prisma.goal.update({
    data: { details: { ...details, placementDeclined: true } },
    where: { id: goal.id },
  });
}

/**
 * Ends placement for a goal, whenever the learner wants ("Stop anytime"): skills placement is sure
 * the learner can do become known in the learner model, and plan items teaching only known skills
 * are tested out. "Start from scratch" changes nothing else and starts every phase at its
 * beginning; the first week's sessions then ask no placement questions.
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

  const plan = await loadGoalPlan(goalId);

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

  const { state, testedOutPlanItemIds } = await applyPlacement({
    goalId,
    now: new Date(),
    plan,
    timeZone: getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone }),
    userId: owned.userId,
  });

  return {
    completion: {
      areas: state.areas,
      complete: state.complete,
      knownSkillIds: state.knownSkillIds,
      phases: state.phases,
      testedOutPlanItemIds,
    },
    // After placement tested items out: where the plan starts now.
    firstLessonId: await findPlanFirstLessonId(goalId),
    status: "ready",
  };
}
