import "server-only";
import { explainQuestionWorkflow } from "@/workflows/v2/explain/explain-question-workflow";
import { goalContentWorkflow } from "@/workflows/v2/goals/goal-content-workflow";
import { researchWorkflow } from "@/workflows/v2/research/research-workflow";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { getGoalGenerationId } from "@zoonk/core/goals/generation-id";
import { recordGoalGeneration } from "@zoonk/core/goals/record-generation";
import { isResearchedGoalKind } from "@zoonk/core/goals/research";
import { type GoalKind } from "@zoonk/db";
import { start } from "workflow/api";
import { type z } from "zod";
import { type goalGenerationSchema } from "./openapi/schemas/content-generation";

type GoalRef = { id: string; kind: GoalKind };

type GoalGeneration = z.infer<typeof goalGenerationSchema>;

async function startGoalRun({
  goal,
  researchId,
}: {
  goal: GoalRef;
  researchId: string | null;
}): Promise<GoalGeneration> {
  const platform = await getRequestPlatform();

  if (goal.kind === "explain") {
    const run = await start(explainQuestionWorkflow, [{ goalId: goal.id, platform }]);
    return { generationId: run.runId, goalId: goal.id, kind: "explanation" };
  }

  const run = await start(goalContentWorkflow, [{ goalId: goal.id, platform, researchId }]);
  return { generationId: run.runId, goalId: goal.id, kind: "curriculum" };
}

/** The run is saved on the goal before this answers, so the goal's screens follow it at once. */
export async function startGoalGeneration({
  goal,
  researchId = null,
}: {
  goal: GoalRef;
  researchId?: string | null;
}): Promise<GoalGeneration> {
  const previous = await getGoalGenerationId({ goalId: goal.id });

  if (previous.status !== "ready") {
    throw new Error("The goal is no longer available to start.");
  }

  const generation = await startGoalRun({ goal, researchId });

  await recordGoalGeneration({
    clearFailure: false,
    expectedGenerationId: previous.generationId,
    generationId: generation.generationId,
    goalId: goal.id,
  });

  return generation;
}

type GoalResearch = { goalId: string; researchId: string };

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

/** A start that fails never undoes the goal; the client can start it again. */
export async function startGoalWork(goals: readonly GoalRef[]) {
  const research = await startGoalResearch(goals);
  const generations = await startGoalContent({ goals, research });

  return { generations, research };
}
