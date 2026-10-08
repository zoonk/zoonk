import { pickPlacementGraphSkillIds } from "@zoonk/core/learner/placement/picks";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { start } from "workflow/api";
import { type GoalRunContext } from "./goal-run-context";
import { placementItemsWorkflow } from "./placement-items-workflow";
import { goalProgressStep } from "./steps/goal-progress-step";

/**
 * Starts the run that writes placement's questions for the picked skills (the plan's own picks
 * when none are given), without waiting for it: placement asks each question as soon as it's
 * stored, and the goal's run goes on to the outlines and the first lessons meanwhile.
 */
async function startPlacementItems({
  context,
  goalId,
  skillIds,
  waitsForNotice = false,
}: {
  context: GoalRunContext;
  goalId: string;
  skillIds?: string[];
  waitsForNotice?: boolean;
}) {
  await start(placementItemsWorkflow, [
    { analytics: context.analytics, goalId, skillIds, waitsForNotice },
  ]);
}

/**
 * Placement's questions for the plan's picks from the skill graph, started once every skill is
 * saved (`skillIds`), without waiting for the goal's courses to be found or prerequisites linked:
 * placement asks each question as soon as it's written and the plan exists, in its own order. Its
 * wait opens while the skills are saved.
 */
export async function prepareGraphPlacement({
  context,
  everySkill,
  goalId,
  graph,
  knownAreas,
  skillIds,
  waitsForNotice,
}: {
  context: GoalRunContext;
  /** A test from the learner's own material: placement asks every topic, so all get questions. */
  everySkill: boolean;
  goalId: string;
  graph: GoalSkillGraph;
  /** The subjects the learner knows well: placement takes their basics as known. */
  knownAreas: readonly string[];
  /** The skills' Library ids by graph key, once every skill is saved. */
  skillIds: Promise<Record<string, string>>;
  /** Research is reading the exam's new notice: the questions wait for its formats. */
  waitsForNotice: boolean;
}) {
  await goalProgressStep({ entityId: goalId, status: "started", step: "preparePlacement" });

  const idsByKey = await skillIds;

  await startPlacementItems({
    context,
    goalId,
    skillIds: pickPlacementGraphSkillIds({ everySkill, graph, idsByKey, knownAreas }),
    waitsForNotice,
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
  await startPlacementItems({ context, goalId });
}
