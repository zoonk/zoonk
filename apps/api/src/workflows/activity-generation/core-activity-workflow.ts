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

/**
 * Core lesson pipeline: background → explanation → mechanics, quiz, examples, story, challenge → review.
 *
 * Dependency graph:
 * background (no deps) → explanation → mechanics, quiz, examples, story, challenge
 * review (needs background + explanation + mechanics + examples)
 */
export async function coreActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  // Wave 1: background content (no dependencies)
  const bgContent = await generateBackgroundContentStep(activities, workflowRunId);

  // Wave 2: explanation content + background visuals (parallel)
  const [expContentResult, bgVisualsResult] = await Promise.allSettled([
    generateExplanationContentStep(activities, bgContent.steps, workflowRunId),
    generateVisualsStep(activities, bgContent.steps, "background"),
  ]);

  const expContent = settled(expContentResult, { steps: [] });
  const bgVisuals = settled(bgVisualsResult, { visuals: [] });

  // Wave 3: downstream content + explanation visuals + background images
  const wave3 = await Promise.allSettled([
    generateMechanicsContentStep(activities, expContent.steps, workflowRunId),
    generateQuizContentStep(activities, expContent.steps, workflowRunId),
    generateExamplesContentStep(activities, expContent.steps, workflowRunId),
    generateStoryContentStep(activities, expContent.steps, workflowRunId),
    generateChallengeContentStep(activities, expContent.steps, workflowRunId),
    generateVisualsStep(activities, expContent.steps, "explanation"),
    generateImagesStep(activities, bgVisuals.visuals, "background"),
  ]);

  const mechContent = settled(wave3[0], { steps: [] });
  const quizContent = settled(wave3[1], { questions: [] });
  const examplesContent = settled(wave3[2], { steps: [] });
  const expVisuals = settled(wave3[5], { visuals: [] });

  // Wave 4: review + mech/examples visuals + quiz/exp images + save bg/story/challenge
  const [mechVisualsResult, examplesVisualsResult] = await Promise.allSettled([
    generateVisualsStep(activities, mechContent.steps, "mechanics"),
    generateVisualsStep(activities, examplesContent.steps, "examples"),
    generateQuizImagesStep(activities, quizContent.questions),
    generateImagesStep(activities, expVisuals.visuals, "explanation"),
    generateReviewContentStep(
      activities,
      bgContent.steps,
      expContent.steps,
      mechContent.steps,
      examplesContent.steps,
      workflowRunId,
    ),
    completeActivityStep(activities, workflowRunId, "background"),
    completeActivityStep(activities, workflowRunId, "story"),
    completeActivityStep(activities, workflowRunId, "challenge"),
  ]);

  const mechVisuals = settled(mechVisualsResult, { visuals: [] });
  const examplesVisuals = settled(examplesVisualsResult, { visuals: [] });

  // Wave 5: mech/examples images + save explanation/quiz/review
  await Promise.allSettled([
    generateImagesStep(activities, mechVisuals.visuals, "mechanics"),
    generateImagesStep(activities, examplesVisuals.visuals, "examples"),
    completeActivityStep(activities, workflowRunId, "explanation"),
    completeActivityStep(activities, workflowRunId, "quiz"),
    completeActivityStep(activities, workflowRunId, "review"),
  ]);

  // Wave 6: save mechanics + save examples
  await Promise.allSettled([
    completeActivityStep(activities, workflowRunId, "mechanics"),
    completeActivityStep(activities, workflowRunId, "examples"),
  ]);
}
