import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityTradeoffSchema } from "@zoonk/ai/tasks/activities/core/tradeoff";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Builds step records from the AI-generated tradeoff content.
 *
 * Splits the single AI output into 2 + N step records:
 * - Position 0: static intro (scenario text)
 * - Positions 1..N: one tradeoff step per round (priorities + outcomes)
 * - Position N+1: static reflection
 *
 * Priorities and resource are copied into each tradeoff step so they're
 * self-contained — the component doesn't need to look up data from
 * other steps.
 */
function buildTradeoffStepRecords(activityId: number, content: ActivityTradeoffSchema) {
  const introStep = {
    activityId,
    content: assertStepContent("static", {
      text: content.scenario.text,
      title: content.scenario.title,
      variant: "text" as const,
    }),
    isPublished: true,
    kind: "static" as const,
    position: 0,
  };

  const roundSteps = content.rounds.map((round, index) => ({
    activityId,
    content: assertStepContent("tradeoff", {
      event: round.event,
      outcomes: round.outcomes,
      priorities: content.priorities,
      resource: content.resource,
      stateModifiers: round.stateModifiers,
      tokenOverride: round.tokenOverride,
    }),
    isPublished: true,
    kind: "tradeoff" as const,
    position: index + 1,
  }));

  const reflectionStep = {
    activityId,
    content: assertStepContent("static", {
      text: content.reflection.text,
      title: content.reflection.title,
      variant: "text" as const,
    }),
    isPublished: true,
    kind: "static" as const,
    position: content.rounds.length + 1,
  };

  return [introStep, ...roundSteps, reflectionStep];
}

/**
 * Persists all tradeoff step records and marks the activity as completed.
 *
 * This is the single save point for a tradeoff entity. The upstream
 * `generateTradeoffContentStep` produces data only — this step writes
 * everything and marks the activity done.
 */
export async function saveTradeoffActivityStep({
  activityId,
  content,
  workflowRunId,
}: {
  activityId: number;
  content: ActivityTradeoffSchema;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveTradeoffActivity" });

  const stepRecords = buildTradeoffStepRecords(activityId, content);

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({ data: stepRecords }),
      prisma.activity.update({
        data: { generationRunId: workflowRunId, generationStatus: "completed" },
        where: { id: activityId },
      }),
    ]),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "saveTradeoffActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  await stream.status({ status: "completed", step: "saveTradeoffActivity" });
}
