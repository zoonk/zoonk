import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStoryDebriefSchema } from "@zoonk/ai/tasks/activities/core/story-debrief";
import { type ActivityStoryStepsSchema } from "@zoonk/ai/tasks/activities/core/story-steps";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Builds step records for a story activity from the AI outputs.
 *
 * - Position 0: static intro step (scene setup + metric definitions)
 * - Positions 1..N: story decision steps (situation + choices)
 * - Position N+1: static debrief step (outcomes + concept reveals)
 */
function buildStoryStepRecords(
  activityId: number,
  storySteps: ActivityStoryStepsSchema,
  debriefData: ActivityStoryDebriefSchema,
) {
  const introRecord = {
    activityId,
    content: assertStepContent("static", {
      intro: storySteps.intro,
      metrics: storySteps.metrics,
      variant: "storyIntro" as const,
    }),
    isPublished: true,
    kind: "static" as const,
    position: 0,
  };

  const decisionRecords = storySteps.steps.map((step, index) => ({
    activityId,
    content: assertStepContent("story", {
      choices: step.choices,
      situation: step.situation,
    }),
    isPublished: true,
    kind: "story" as const,
    position: index + 1,
  }));

  const debriefRecord = {
    activityId,
    content: assertStepContent("static", {
      debrief: debriefData.debrief,
      outcomes: debriefData.outcomes,
      variant: "storyDebrief" as const,
    }),
    isPublished: true,
    kind: "static" as const,
    position: storySteps.steps.length + 1,
  };

  return [introRecord, ...decisionRecords, debriefRecord];
}

/**
 * Persists all generated story data in one transaction:
 * - Static intro step with metrics
 * - Interactive decision steps with choices and consequences
 * - Static debrief step with outcomes and concept reveals
 * - Marks the activity as completed
 *
 * This is the single save point for a story entity.
 * Upstream generate steps (content, debrief) produce data only;
 * this step writes everything to the database at once.
 */
export async function saveStoryActivityStep({
  activityId,
  debriefData,
  storySteps,
  workflowRunId,
}: {
  activityId: number;
  debriefData: ActivityStoryDebriefSchema;
  storySteps: ActivityStoryStepsSchema;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveStoryActivity" });

  const stepRecords = buildStoryStepRecords(activityId, storySteps, debriefData);

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
    await stream.error({ reason: "dbSaveFailed", step: "saveStoryActivity" });
    await handleActivityFailureStep({ activityId });
    return;
  }

  await stream.status({ status: "completed", step: "saveStoryActivity" });
}
