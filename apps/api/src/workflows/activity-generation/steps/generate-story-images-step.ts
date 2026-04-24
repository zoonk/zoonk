import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStorySchema } from "@zoonk/ai/tasks/activities/core/story";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { STORY_OUTCOME_TIERS, type StoryOutcomeTier } from "@zoonk/utils/activities";
import { generateStepImages } from "./_utils/generate-step-images";
import { type LessonActivity } from "./get-lesson-activities-step";

export type GeneratedStoryImages = {
  choiceStateImages: StepImage[][];
  introImage: StepImage;
  outcomeImages: Record<StoryOutcomeTier, StepImage>;
  stepImages: StepImage[];
};

/**
 * Story choice image groups are reconstructed by step so save/render logic can
 * stay aligned with the learner-visible order instead of juggling flat arrays.
 */
function groupChoiceImages({
  choiceCounts,
  images,
}: {
  choiceCounts: number[];
  images: StepImage[];
}) {
  let offset = 0;

  return choiceCounts.map((count, stepIndex) => {
    const grouped = images.slice(offset, offset + count);

    if (grouped.length !== count) {
      throw new Error(`Story choice images are missing for step ${stepIndex + 1}`);
    }

    offset += count;
    return grouped;
  });
}

/**
 * Finds the image position for a tier in the shared prompt order.
 */
function getOutcomeTierIndex(tier: StoryOutcomeTier) {
  return STORY_OUTCOME_TIERS.indexOf(tier);
}

/**
 * Reads one generated outcome image by position because image generation
 * returns a flat array in prompt order.
 */
function getOutcomeImage({
  images,
  index,
  tier,
}: {
  images: StepImage[];
  index: number;
  tier: StoryOutcomeTier;
}) {
  const image = images[index];

  if (!image) {
    throw new Error(`Story outcome image is missing for ${tier}`);
  }

  return image;
}

/**
 * Outcome prompts are generated in the shared tier order, then converted back
 * to a keyed object so save/render code cannot accidentally mix endings.
 */
function groupOutcomeImages(images: StepImage[]): Record<StoryOutcomeTier, StepImage> {
  return {
    bad: getOutcomeImage({ images, index: getOutcomeTierIndex("bad"), tier: "bad" }),
    good: getOutcomeImage({ images, index: getOutcomeTierIndex("good"), tier: "good" }),
    ok: getOutcomeImage({ images, index: getOutcomeTierIndex("ok"), tier: "ok" }),
    perfect: getOutcomeImage({
      images,
      index: getOutcomeTierIndex("perfect"),
      tier: "perfect",
    }),
    terrible: getOutcomeImage({
      images,
      index: getOutcomeTierIndex("terrible"),
      tier: "terrible",
    }),
  } satisfies Record<StoryOutcomeTier, StepImage>;
}

/**
 * Story visuals now only generate scene images. Metric and choice icons were
 * removed until the image model supports proper transparent backgrounds.
 */
function getScenePromptGroups({ storyData }: { storyData: ActivityStorySchema }) {
  const choiceCounts = storyData.steps.map((step) => step.choices.length);

  const scenePrompts = [
    storyData.introImagePrompt,
    ...storyData.steps.map((step) => step.imagePrompt),
    ...storyData.steps.flatMap((step) => step.choices.map((choice) => choice.stateImagePrompt)),
    ...STORY_OUTCOME_TIERS.map((tier) => storyData.outcomes[tier].imagePrompt),
  ];

  return { choiceCounts, scenePrompts };
}

/**
 * Story scene images are sliced back into the intro, per-step, per-choice
 * state, and outcome buckets after generation.
 */
function buildStoryImageBundle({
  choiceCounts,
  outcomeCount,
  sceneImages,
  stepCount,
}: {
  choiceCounts: number[];
  outcomeCount: number;
  sceneImages: StepImage[];
  stepCount: number;
}): GeneratedStoryImages {
  const totalChoiceCount = choiceCounts.reduce((sum, count) => sum + count, 0);
  const expectedSceneCount = 1 + stepCount + totalChoiceCount + outcomeCount;

  if (sceneImages.length !== expectedSceneCount) {
    throw new Error("Generated story scene image count does not match prompts");
  }

  const [introImage, ...remainingSceneImages] = sceneImages;

  if (!introImage) {
    throw new Error("Story intro image is missing");
  }

  const stepImages = remainingSceneImages.slice(0, stepCount);
  const choiceStateImages = remainingSceneImages.slice(stepCount, stepCount + totalChoiceCount);
  const outcomeImages = remainingSceneImages.slice(stepCount + totalChoiceCount);

  if (stepImages.length !== stepCount) {
    throw new Error("Story step images are missing");
  }

  if (outcomeImages.length !== outcomeCount) {
    throw new Error("Story outcome images are missing");
  }

  return {
    choiceStateImages: groupChoiceImages({ choiceCounts, images: choiceStateImages }),
    introImage,
    outcomeImages: groupOutcomeImages(outcomeImages),
    stepImages,
  };
}

/**
 * Story visuals are a first-class part of the activity. This step keeps
 * the expensive image generation in one place so the workflow emits one image
 * phase while keeping the player focused on large scene images only.
 */
export async function generateStoryImagesStep({
  activity,
  storyData,
}: {
  activity: LessonActivity;
  storyData: ActivityStorySchema;
}): Promise<GeneratedStoryImages> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);
  await stream.status({ status: "started", step: "generateStepImages" });

  const { choiceCounts, scenePrompts } = getScenePromptGroups({ storyData });
  const orgSlug = activity.lesson.chapter.course.organization?.slug;

  const sceneImagesResult = await generateStepImages({
    language: activity.language,
    orgSlug,
    preset: "story",
    prompts: scenePrompts,
  });

  const bundle = buildStoryImageBundle({
    choiceCounts,
    outcomeCount: STORY_OUTCOME_TIERS.length,
    sceneImages: sceneImagesResult,
    stepCount: storyData.steps.length,
  });

  await stream.status({ status: "completed", step: "generateStepImages" });

  return bundle;
}
