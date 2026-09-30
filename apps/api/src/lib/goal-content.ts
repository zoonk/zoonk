import "server-only";
import { explainQuestionWorkflow } from "@/workflows/v2/explain/explain-question-workflow";
import { goalContentWorkflow } from "@/workflows/v2/goals/goal-content-workflow";
import { researchWorkflow } from "@/workflows/v2/research/research-workflow";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { isResearchedGoalKind } from "@zoonk/core/goals/research";
import { type GoalKind } from "@zoonk/db";
import { start } from "workflow/api";
import { type z } from "zod";
import { type goalGenerationSchema } from "./openapi/schemas/content-generation";

type GoalRef = { id: string; kind: GoalKind };

type GoalGeneration = z.infer<typeof goalGenerationSchema>;

/**
 * Starts what one goal needs written: an explain question's quick explanation (claimed against the
 * learner's allowance when the goal was created), or every other goal's curriculum, waiting for the
 * research run started with it (an exam's blueprint, a learn goal's references). The run carries
 * the client that asked, for analytics.
 */
export async function startGoalGeneration({
  goal,
  researchId = null,
}: {
  goal: GoalRef;
  researchId?: string | null;
}): Promise<GoalGeneration> {
  const platform = await getRequestPlatform();

  if (goal.kind === "explain") {
    const run = await start(explainQuestionWorkflow, [{ goalId: goal.id, platform }]);
    return { generationId: run.runId, goalId: goal.id, kind: "explanation" };
  }

  const run = await start(goalContentWorkflow, [{ goalId: goal.id, platform, researchId }]);
  return { generationId: run.runId, goalId: goal.id, kind: "curriculum" };
}

type GoalResearch = { goalId: string; researchId: string };

/** Research for each new goal whose kind needs it (see `isResearchedGoalKind`). */
async function startGoalResearch(goals: readonly GoalRef[]): Promise<GoalResearch[]> {
  const runs = await Promise.allSettled(
    goals
      .filter((goal) => isResearchedGoalKind(goal.kind))
      .map(async (goal) => {
        const run = await start(researchWorkflow, [{ goalId: goal.id }]);
        return { goalId: goal.id, researchId: run.runId };
      }),
  );

  return runs.flatMap((run) => (run.status === "fulfilled" ? [run.value] : []));
}

/** The curriculum or explanation of each goal, waiting for the research run started with it. */
async function startGoalContent({
  goals,
  research,
}: {
  goals: readonly GoalRef[];
  research: readonly GoalResearch[];
}): Promise<GoalGeneration[]> {
  const started = await Promise.allSettled(
    goals.map((goal) =>
      startGoalGeneration({
        goal,
        researchId: research.find((entry) => entry.goalId === goal.id)?.researchId,
      }),
    ),
  );

  return started.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : []));
}

/**
 * Starts what goals the learner just got need, the same for every route that creates one (a new
 * goal, an exam move, the next level): research first, then each goal's curriculum or quick
 * explanation, so the skill graph and first lessons are written while onboarding and placement
 * run. A start that fails never undoes the goal; the client can start it again for that goal.
 */
export async function startGoalWork(goals: readonly GoalRef[]) {
  const research = await startGoalResearch(goals);
  const generations = await startGoalContent({ goals, research });

  return { generations, research };
}
