import { randomUUID } from "node:crypto";
import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStorySchema } from "@zoonk/ai/tasks/activities/core/story";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type StoryOutcomeTier } from "@zoonk/utils/activities";
import { safeAsync } from "@zoonk/utils/error";
import { type GeneratedStoryImages } from "./generate-story-images-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * The AI only owns learner-facing story content. Runtime identity is assigned
 * while saving so choice IDs stay implementation-owned and the player can
 * safely track selections after options are shuffled.
 */
function buildStoryChoices({
  choiceStateImages,
  choices,
  stepIndex,
}: {
  choiceStateImages: GeneratedStoryImages["choiceStateImages"][number];
  choices: ActivityStorySchema["steps"][number]["choices"];
  stepIndex: number;
}) {
  return choices.map((choice, choiceIndex) => {
    const stateImage = choiceStateImages[choiceIndex];

    if (!stateImage) {
      throw new Error(`Story choice state image is missing for step ${stepIndex + 1}`);
    }

    return {
      alignment: choice.alignment,
      consequence: choice.consequence,
      id: randomUUID(),
      metricEffects: choice.metricEffects,
      stateImage,
      text: choice.label,
    };
  });
}

/**
 * Story scene images are required for the new image-led flow, so this helper
 * turns a missing array entry into a clear save-time failure instead of a
 * silently degraded step.
 */
function getRequiredStoryImage({ image, label }: { image?: StepImage; label: string }): StepImage {
  if (!image) {
    throw new Error(`Story image is missing for ${label}`);
  }

  return image;
}

/**
 * Builds one keyed persisted outcome from the generated story text and image.
 */
function buildStoryOutcome({
  outcomeImages,
  outcomes,
  tier,
}: {
  outcomeImages: GeneratedStoryImages["outcomeImages"];
  outcomes: ActivityStorySchema["outcomes"];
  tier: StoryOutcomeTier;
}) {
  const outcome = outcomes[tier];

  return {
    image: getRequiredStoryImage({ image: outcomeImages[tier], label: `outcome ${tier}` }),
    narrative: outcome.narrative,
    title: outcome.title,
  };
}

/**
 * Outcome tiers are fixed app routing states. The AI supplies tier narratives,
 * image generation supplies tier images, and this helper combines them into
 * the persisted player contract without exposing scoring thresholds to AI.
 */
function buildStoryOutcomes({
  outcomeImages,
  outcomes,
}: {
  outcomeImages: GeneratedStoryImages["outcomeImages"];
  outcomes: ActivityStorySchema["outcomes"];
}) {
  return {
    bad: buildStoryOutcome({ outcomeImages, outcomes, tier: "bad" }),
    good: buildStoryOutcome({ outcomeImages, outcomes, tier: "good" }),
    ok: buildStoryOutcome({ outcomeImages, outcomes, tier: "ok" }),
    perfect: buildStoryOutcome({ outcomeImages, outcomes, tier: "perfect" }),
    terrible: buildStoryOutcome({ outcomeImages, outcomes, tier: "terrible" }),
  } satisfies Record<StoryOutcomeTier, { image: StepImage; narrative: string; title: string }>;
}

/**
 * Builds step records for a story activity from the AI outputs plus the
 * generated image bundle.
 *
 * - Position 0: static intro step (scene setup + metric definitions)
 * - Positions 1..N: story decision steps (problem + choices)
 * - Position N+1: static outcome step (narrative results + final metrics)
 */
function buildStoryStepRecords(
  activityId: string,
  storyImages: GeneratedStoryImages,
  storyData: ActivityStorySchema,
) {
  const metrics = storyData.metrics.map((label) => ({ label }));

  const introRecord = {
    activityId,
    content: assertStepContent("static", {
      image: storyImages.introImage,
      text: storyData.intro,
      title: storyData.title,
      variant: "intro" as const,
    }),
    isPublished: true,
    kind: "static" as const,
    position: 0,
  };

  const decisionRecords = storyData.steps.map((step, index) => ({
    activityId,
    content: assertStepContent("story", {
      choices: buildStoryChoices({
        choiceStateImages: storyImages.choiceStateImages[index] ?? [],
        choices: step.choices,
        stepIndex: index,
      }),
      image: getRequiredStoryImage({
        image: storyImages.stepImages[index],
        label: `step ${index + 1}`,
      }),
      problem: step.problem,
    }),
    isPublished: true,
    kind: "story" as const,
    position: index + 1,
  }));

  const outcomeRecord = {
    activityId,
    content: assertStepContent("static", {
      metrics,
      outcomes: buildStoryOutcomes({
        outcomeImages: storyImages.outcomeImages,
        outcomes: storyData.outcomes,
      }),
      variant: "storyOutcome" as const,
    }),
    isPublished: true,
    kind: "static" as const,
    position: storyData.steps.length + 1,
  };

  return [introRecord, ...decisionRecords, outcomeRecord];
}

/**
 * Persists all generated story data in one transaction:
 * - Static intro step with setup title, text, and image
 * - Interactive decision steps with choices and consequences
 * - Static outcome step with narrative results and final metrics
 * - Marks the activity as completed
 *
 * This is the single save point for a story entity.
 * Upstream generate steps produce data only;
 * this step writes everything to the database at once.
 */
export async function saveStoryActivityStep({
  activityId,
  storyImages,
  storyData,
  workflowRunId,
}: {
  activityId: string;
  storyImages: GeneratedStoryImages;
  storyData: ActivityStorySchema;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveStoryActivity" });

  const stepRecords = buildStoryStepRecords(activityId, storyImages, storyData);

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({ data: stepRecords }),
      prisma.activity.update({
        data: {
          generationRunId: workflowRunId,
          generationStatus: "completed",
          title: storyData.title,
        },
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
