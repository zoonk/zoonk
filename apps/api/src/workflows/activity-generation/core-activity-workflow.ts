import { settled } from "@zoonk/utils/settled";
import { completeActivityStep } from "./steps/complete-activity-step";
import { generateBackgroundContentStep } from "./steps/generate-background-content-step";
import { generateChallengeContentStep } from "./steps/generate-challenge-content-step";
import { generateExamplesContentStep } from "./steps/generate-examples-content-step";
import { generateExplanationContentStep } from "./steps/generate-explanation-content-step";
import { generateImagesStep } from "./steps/generate-images-step";
import { generateMechanicsContentStep } from "./steps/generate-mechanics-content-step";
import { generateQuizContentStep } from "./steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "./steps/generate-quiz-images-step";
import { generateReviewContentStep } from "./steps/generate-review-content-step";
import { generateStoryContentStep } from "./steps/generate-story-content-step";
import { generateVisualsStep } from "./steps/generate-visuals-step";
import { type LessonActivity } from "./steps/get-lesson-activities-step";

type ExplanationVisualResult = {
  activityId: bigint | number;
  visuals: Awaited<ReturnType<typeof generateVisualsStep>>["visuals"];
};

const WAVE2_MECHANICS_INDEX = 0;
const WAVE2_EXAMPLES_INDEX = 1;
const WAVE2_QUIZ_INDEX = 4;
const WAVE2_BACKGROUND_VISUALS_INDEX = 5;

function hasActivityId(result: {
  activityId: bigint | number | undefined;
  visuals: ExplanationVisualResult["visuals"];
}): result is ExplanationVisualResult {
  return Boolean(result.activityId);
}

function getSettledVisualsResult(
  result: PromiseSettledResult<Awaited<ReturnType<typeof generateVisualsStep>>>,
): ExplanationVisualResult["visuals"] {
  return settled(result, {
    visuals: [] as ExplanationVisualResult["visuals"],
  }).visuals;
}

/**
 * Core lesson pipeline: generate independent content first, then quiz/review dependencies, then visuals/images.
 *
 * Quiz depends on explanation steps. Review currently depends on background, explanation, mechanics, and examples.
 */
export async function coreActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  // Wave 1: background + explanations in parallel
  const [bgContentResult, explanationContentResult] = await Promise.allSettled([
    generateBackgroundContentStep(activities, workflowRunId),
    generateExplanationContentStep(activities, workflowRunId),
  ]);

  const bgContent = settled(bgContentResult, { steps: [] });
  const explanationContent = settled(explanationContentResult, { results: [] });
  const explanationSteps = explanationContent.results.flatMap((result) => result.steps);

  const explanationVisualPromises = explanationContent.results.map((result) =>
    generateVisualsStep(activities, result.steps, "explanation", result.activityId),
  );

  // Wave 2: core content + quiz + background/explanation visuals
  const [wave2, explanationVisualSettled] = await Promise.all([
    Promise.allSettled([
      generateMechanicsContentStep(activities, workflowRunId),
      generateExamplesContentStep(activities, workflowRunId),
      generateStoryContentStep(activities, workflowRunId),
      generateChallengeContentStep(activities, workflowRunId),
      generateQuizContentStep(activities, explanationContent.results, workflowRunId),
      generateVisualsStep(activities, bgContent.steps, "background"),
    ]),
    Promise.allSettled(explanationVisualPromises),
  ]);

  const mechanicsContent = settled(wave2[WAVE2_MECHANICS_INDEX], { steps: [] });
  const examplesContent = settled(wave2[WAVE2_EXAMPLES_INDEX], { steps: [] });
  const quizContent = settled(wave2[WAVE2_QUIZ_INDEX], { results: [] });
  const bgVisuals = settled(wave2[WAVE2_BACKGROUND_VISUALS_INDEX], { visuals: [] });

  const explanationVisualResults = explanationVisualSettled
    .map((result, index) => ({
      activityId: explanationContent.results[index]?.activityId,
      visuals: getSettledVisualsResult(result),
    }))
    .filter((result): result is ExplanationVisualResult => hasActivityId(result));

  const explanationImagePromises = explanationVisualResults.map((result) =>
    generateImagesStep(activities, result.visuals, "explanation", result.activityId),
  );

  const quizImagePromises = quizContent.results.map((result) =>
    generateQuizImagesStep(activities, result.questions, result.activityId),
  );

  // Wave 3: review + visuals + images
  const wave3 = await Promise.allSettled([
    generateReviewContentStep(
      activities,
      bgContent.steps,
      explanationSteps,
      mechanicsContent.steps,
      examplesContent.steps,
      workflowRunId,
    ),
    generateVisualsStep(activities, mechanicsContent.steps, "mechanics"),
    generateVisualsStep(activities, examplesContent.steps, "examples"),
    generateImagesStep(activities, bgVisuals.visuals, "background"),
    ...explanationImagePromises,
    ...quizImagePromises,
  ]);

  const mechanicsVisuals = settled(wave3[1], { visuals: [] });
  const examplesVisuals = settled(wave3[2], { visuals: [] });

  // Wave 4: remaining images + finalize all generated activities
  await Promise.allSettled([
    generateImagesStep(activities, mechanicsVisuals.visuals, "mechanics"),
    generateImagesStep(activities, examplesVisuals.visuals, "examples"),
    completeActivityStep(activities, workflowRunId, "background"),
    completeActivityStep(activities, workflowRunId, "explanation"),
    completeActivityStep(activities, workflowRunId, "mechanics"),
    completeActivityStep(activities, workflowRunId, "examples"),
    completeActivityStep(activities, workflowRunId, "story"),
    completeActivityStep(activities, workflowRunId, "challenge"),
    completeActivityStep(activities, workflowRunId, "quiz"),
    completeActivityStep(activities, workflowRunId, "review"),
  ]);
}
