import { pickPlacementGraphSkillIds } from "@zoonk/core/learner/placement/picks";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { type GoalRunContext } from "./goal-run-context";
import { recordPlacementPreparedStep } from "./steps/goal-build-outcome-steps";
import { preparePlacementItemsStep } from "./steps/goal-lookahead-steps";
import { goalProgressStep } from "./steps/goal-progress-step";

/**
 * Writes placement's questions for the picked skills (the plan's own picks when none are given),
 * then records that they're written, counting the ones that couldn't be: placement stops waiting
 * for those, and goes on without placement when none could be written.
 */
async function writePlacementItems({
  context,
  goalId,
  skillIds,
}: {
  context: GoalRunContext;
  goalId: string;
  skillIds?: string[];
}) {
  const { failed, written } = await preparePlacementItemsStep({ ...context, goalId, skillIds });

  await Promise.all([
    recordPlacementPreparedStep({ failed, goalId, written }),
    failed > 0
      ? trackGenerationFailedStep({
          analytics: context.analytics,
          contentKind: "curriculum",
          task: "placement-questions",
        })
      : null,
  ]);

  await goalProgressStep({ entityId: goalId, status: "completed", step: "preparePlacement" });
}

/**
 * Placement's questions for the plan's picks from the skill graph, written alongside the plan once
 * every skill is saved and linked (`saved`), never before the plan's own step: placement asks each
 * question as soon as it's written and the plan exists, in its own order. Its wait opens while the
 * skills are saved.
 */
export async function prepareGraphPlacement({
  context,
  goalId,
  graph,
  saved,
}: {
  context: GoalRunContext;
  goalId: string;
  graph: GoalSkillGraph;
  /** The skills' Library ids by graph key, once every skill is saved and linked. */
  saved: Promise<{ idsByKey: Record<string, string> }>;
}) {
  await goalProgressStep({ entityId: goalId, status: "started", step: "preparePlacement" });

  const { idsByKey } = await saved;

  await writePlacementItems({
    context,
    goalId,
    skillIds: pickPlacementGraphSkillIds({ graph, idsByKey }),
  });
}

/** Placement's questions for a plan that came with the goal, from the plan's own picks. */
export async function preparePlanPlacement({
  context,
  goalId,
}: {
  context: GoalRunContext;
  goalId: string;
}) {
  await goalProgressStep({ entityId: goalId, status: "started", step: "preparePlacement" });
  await writePlacementItems({ context, goalId });
}
