import { type generateSkillGraph } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { prepareCourseGoalPlan } from "@zoonk/core/goals/prepare-course-plan";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { createGoalPlan } from "@zoonk/core/plans/create";
import { isNoticeLandingExpiredError } from "@zoonk/core/plans/notice-wait";
import { type PlanSetupTask, listPlanSetupTasks, runPlanSetupTask } from "@zoonk/core/plans/setup";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";

type GraphProvenance = Awaited<ReturnType<typeof generateSkillGraph>>["provenance"];

export async function prepareCourseGoalPlanStep(input: {
  goalId: string;
  platform: AnalyticsPlatform | null;
}): Promise<void> {
  "use step";

  await prepareCourseGoalPlan(input);
}

type GraphPlanInput = {
  courseIdsByKey: Record<string, string>;
  goalId: string;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
  platform: AnalyticsPlatform | null;
  provenance: GraphProvenance;
};

function toGraphPlan({
  courseIdsByKey,
  goalId,
  graph,
  idsByKey,
  platform,
  provenance,
}: GraphPlanInput) {
  return {
    goalId,
    graph: toGoalPlanGraph({ courseIdsByKey, graph, idsByKey }),
    platform,
    provenance: {
      generatedAt: new Date(provenance.generatedAt),
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      runId: provenance.runId,
    },
    setup: "steps" as const,
  };
}

export async function createGoalPlanStep(
  input: GraphPlanInput,
): Promise<PlanStepOutcome<PlanSetupTask[]>> {
  "use step";

  return catchPlanConflict(async () => {
    const { setupTasks } = await createGoalPlan(toGraphPlan(input));
    return setupTasks;
  });
}

export async function followNoticeStep(input: GraphPlanInput): Promise<PlanStepOutcome<boolean>> {
  "use step";

  return catchPlanConflict(async () => {
    const [built] = await Promise.allSettled([
      createGoalPlan({ ...toGraphPlan(input), followNotice: true }),
    ]);

    if (built.status === "fulfilled") {
      return true;
    }

    const reason: unknown = built.reason;

    if (isNoticeLandingExpiredError(reason)) {
      return false;
    }

    throw reason;
  });
}

export async function runPlanSetupTaskStep(input: {
  goalId: string;
  task: PlanSetupTask;
}): Promise<void> {
  "use step";

  await runPlanSetupTask(input);
}

export async function listPlanSetupTasksStep(goalId: string): Promise<PlanSetupTask[]> {
  "use step";

  return listPlanSetupTasks(goalId);
}
