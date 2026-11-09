import "server-only";
import { startResearch } from "@/lib/research";
import { startOnce } from "@/workflows/_shared/run-token";
import {
  explainQuestionWorkflow,
  getExplainQuestionToken,
} from "@/workflows/explain/explain-question-workflow";
import { getGoalContentToken, goalContentWorkflow } from "@/workflows/goals/goal-content-workflow";
import { getGoalRebuildAsk } from "@/workflows/goals/goal-rebuild-ask";
import { rebuildGoalCurriculumWorkflow } from "@/workflows/goals/rebuild-goal-curriculum-workflow";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { getGoalGenerationId } from "@zoonk/core/goals/generation-id";
import { type GoalRebuildFollowUp } from "@zoonk/core/goals/rebuild-follow-up";
import { recordGoalGeneration } from "@zoonk/core/goals/record-generation";
import { isResearchedGoalKind } from "@zoonk/core/goals/research";
import { type GoalKind } from "@zoonk/db";
import { type z } from "zod";
import { type goalGenerationSchema } from "./openapi/schemas/content-generation";

type GoalRef = { followUp?: GoalRebuildFollowUp; id: string; kind: GoalKind };

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
    const generationId = await startOnce(
      explainQuestionWorkflow,
      [{ goalId: goal.id, platform }],
      getExplainQuestionToken(goal.id),
    );

    return { generationId, goalId: goal.id, kind: "explanation" };
  }

  if (goal.followUp) {
    const { followUp } = goal;

    const generationId = await startOnce(
      rebuildGoalCurriculumWorkflow,
      [{ followUp, goalId: goal.id, platform, researchId }],
      getGoalRebuildAsk({ followUp, goalId: goal.id }),
    );

    return { generationId, goalId: goal.id, kind: "curriculum" };
  }

  const generationId = await startOnce(
    goalContentWorkflow,
    [{ goalId: goal.id, platform, researchId }],
    getGoalContentToken({ goalId: goal.id }),
  );

  return { generationId, goalId: goal.id, kind: "curriculum" };
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
        const researchId = await startResearch({ goalId: goal.id });
        return { goalId: goal.id, researchId };
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
