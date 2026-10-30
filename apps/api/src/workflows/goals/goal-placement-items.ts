import { pickPlacementGraphSkillIds } from "@zoonk/core/learner/placement/picks";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { start } from "workflow/api";
import { type GoalRunContext } from "./goal-run-context";
import { placementItemsWorkflow } from "./placement-items-workflow";
import { goalProgressStep } from "./steps/goal-progress-step";

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

export async function prepareGraphPlacement({
  context,
  everySkill,
  goalId,
  graph,
  knownAreas,
  ownLevel,
  skillIds,
  waitsForNotice,
}: {
  context: GoalRunContext;
  everySkill: boolean;
  goalId: string;
  graph: GoalSkillGraph;
  knownAreas: readonly string[];
  ownLevel: Parameters<typeof pickPlacementGraphSkillIds>[0]["ownLevel"];
  skillIds: Promise<Record<string, string>>;
  waitsForNotice: boolean;
}) {
  await goalProgressStep({ entityId: goalId, status: "started", step: "preparePlacement" });

  const idsByKey = await skillIds;

  await startPlacementItems({
    context,
    goalId,
    skillIds: pickPlacementGraphSkillIds({ everySkill, graph, idsByKey, knownAreas, ownLevel }),
    waitsForNotice,
  });
}

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
