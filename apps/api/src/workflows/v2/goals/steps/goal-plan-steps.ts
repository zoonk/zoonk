import { type generateSkillGraph } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { createGoalPlan } from "@zoonk/core/plans/create";
import { isNoticeLandingExpiredError } from "@zoonk/core/plans/notice-wait";
import { type PlanSetupTask, listPlanSetupTasks, runPlanSetupTask } from "@zoonk/core/plans/setup";
import { withAiRetry } from "../../_shared/ai-retry";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";

type GraphProvenance = Awaited<ReturnType<typeof generateSkillGraph>>["provenance"];

type GraphPlanInput = {
  courseIdsByKey: Record<string, string>;
  goalId: string;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
  /** The client that started the run, for "Plan Created". */
  platform: AnalyticsPlatform | null;
  provenance: GraphProvenance;
};

/** What `createGoalPlan` builds the plan from, out of a step's input. */
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

/**
 * Builds the plan from the graph at the learner's daily minutes: phases with dates, and one stand-in
 * per skill until the outlines give it lessons. Each skill's lessons come only from the Library
 * course found for its graph course. Placement can start as soon as this is saved. Returns the
 * setup a new plan owes, which the run does one step per task (`runPlanSetupTaskStep`). A plan
 * whose inputs kept changing while it was worked out (other runs saving its lessons and questions)
 * comes back as a conflict, for the run to build it again later (see `retryPlanConflicts`).
 */
export async function createGoalPlanStep(
  input: GraphPlanInput,
): Promise<PlanStepOutcome<PlanSetupTask[]>> {
  "use step";

  return catchPlanConflict(async () => {
    const { setupTasks } = await createGoalPlan(toGraphPlan(input));
    return setupTasks;
  });
}

/**
 * The plan built again from the graph, following the exam's notice read while the reveal waited:
 * its day becomes the plan's. False when the reveal stopped waiting before the plan could be saved
 * (see `isNoticeLandingExpiredError`): the learner may have seen the plan, so the reading waits on
 * Today instead. A plan that kept changing comes back as a conflict, like any plan (see
 * `createGoalPlanStep`).
 */
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

/**
 * One setup task the new plan owes (see `runPlanSetupTask`), done once. A failure throws, so the
 * runtime retries it; the routine's fit is a model call, retried after a minute when rate limited.
 */
export async function runPlanSetupTaskStep(input: {
  goalId: string;
  task: PlanSetupTask;
}): Promise<void> {
  "use step";

  await withAiRetry(() => runPlanSetupTask(input));
}

/** The setup the goal's plan still owes, in the order it runs. */
export async function listPlanSetupTasksStep(goalId: string): Promise<PlanSetupTask[]> {
  "use step";

  return listPlanSetupTasks(goalId);
}
