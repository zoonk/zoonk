import { type QuizQuestion } from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { getWorkflowMetadata } from "workflow";
import { type ActivitySteps } from "./steps/_utils/get-activity-steps";
import { generateBackgroundContentStep } from "./steps/generate-background-content-step";
import { generateChallengeContentStep } from "./steps/generate-challenge-content-step";
import {
  type CustomContentResult,
  generateCustomContentStep,
} from "./steps/generate-custom-content-step";
import { generateCustomImagesStep } from "./steps/generate-custom-images-step";
import {
  type CustomVisualResult,
  generateCustomVisualsStep,
} from "./steps/generate-custom-visuals-step";
import { generateExamplesContentStep } from "./steps/generate-examples-content-step";
import { generateExplanationContentStep } from "./steps/generate-explanation-content-step";
import { generateImagesStep } from "./steps/generate-images-step";
import { generateMechanicsContentStep } from "./steps/generate-mechanics-content-step";
import { generateQuizContentStep } from "./steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "./steps/generate-quiz-images-step";
import { generateReviewContentStep } from "./steps/generate-review-content-step";
import { generateStoryContentStep } from "./steps/generate-story-content-step";
import { type StepVisual, generateVisualsStep } from "./steps/generate-visuals-step";
import { type LessonActivity, getLessonActivitiesStep } from "./steps/get-lesson-activities-step";
import { handleWorkflowFailureStep } from "./steps/handle-workflow-failure-step";
import { saveActivityStep } from "./steps/save-activity-step";
import { saveCustomActivitiesStep } from "./steps/save-custom-activities-step";

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

/**
 * Waves 4-6: visuals/images for downstream activities + save all.
 */
async function runFinalWaves(
  activities: LessonActivity[],
  workflowRunId: string,
  bgContent: { steps: ActivitySteps },
  expContent: { steps: ActivitySteps },
  wave3: {
    examplesContent: { steps: ActivitySteps };
    expVisuals: { visuals: StepVisual[] };
    mechContent: { steps: ActivitySteps };
    quizContent: { questions: QuizQuestion[] };
  },
): Promise<void> {
  // Wave 4: review + mech/examples visuals + quiz/exp images + save bg/story/challenge/custom
  const [mechVisualsResult, examplesVisualsResult] = await Promise.allSettled([
    generateVisualsStep(activities, wave3.mechContent.steps, "mechanics"),
    generateVisualsStep(activities, wave3.examplesContent.steps, "examples"),
    generateQuizImagesStep(activities, wave3.quizContent.questions),
    generateImagesStep(activities, wave3.expVisuals.visuals, "explanation"),
    generateReviewContentStep(
      activities,
      bgContent.steps,
      expContent.steps,
      wave3.mechContent.steps,
      wave3.examplesContent.steps,
      workflowRunId,
    ),
    saveActivityStep(activities, workflowRunId, "background"),
    saveActivityStep(activities, workflowRunId, "story"),
    saveActivityStep(activities, workflowRunId, "challenge"),
    saveCustomActivitiesStep(activities, workflowRunId),
  ]);

  const mechVisuals = settled(mechVisualsResult, { visuals: [] });
  const examplesVisuals = settled(examplesVisualsResult, { visuals: [] });

  // Wave 5: mech/examples images + save explanation/quiz/review
  await Promise.allSettled([
    generateImagesStep(activities, mechVisuals.visuals, "mechanics"),
    generateImagesStep(activities, examplesVisuals.visuals, "examples"),
    saveActivityStep(activities, workflowRunId, "explanation"),
    saveActivityStep(activities, workflowRunId, "quiz"),
    saveActivityStep(activities, workflowRunId, "review"),
  ]);

  // Wave 6: save mechanics + save examples
  await Promise.allSettled([
    saveActivityStep(activities, workflowRunId, "mechanics"),
    saveActivityStep(activities, workflowRunId, "examples"),
  ]);
}

/**
 * Activity generation workflow.
 *
 * Linear workflow with parallel batches where dependencies allow.
 * Steps save data to DB immediately after generation (for resumption).
 * Steps query DB to check for existing data before generating (skip completed work).
 *
 * Dependency graph:
 * background (no deps) → explanation → mechanics, quiz, examples, story, challenge
 * custom (no deps)
 * review (needs background + explanation + mechanics + examples)
 */
export async function activityGenerationWorkflow(lessonId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  try {
    const activities = await getLessonActivitiesStep(lessonId);

    // Wave 1: background content + custom content (no dependencies)
    const [bgContentResult, customContentResult] = await Promise.allSettled([
      generateBackgroundContentStep(activities, workflowRunId),
      generateCustomContentStep(activities, workflowRunId),
    ]);

    const bgContent = settled(bgContentResult, { steps: [] });
    const customContent = settled(customContentResult, [] as CustomContentResult[]);

    // Wave 2: explanation content + background visuals + custom visuals (parallel)
    const [expContentResult, bgVisualsResult, customVisualsResult] = await Promise.allSettled([
      generateExplanationContentStep(activities, bgContent.steps, workflowRunId),
      generateVisualsStep(activities, bgContent.steps, "background"),
      generateCustomVisualsStep(activities, customContent),
    ]);

    const expContent = settled(expContentResult, { steps: [] });
    const bgVisuals = settled(bgVisualsResult, { visuals: [] });
    const customVisuals = settled(customVisualsResult, [] as CustomVisualResult[]);

    // Wave 3: downstream content + explanation visuals + background/custom images
    const wave3 = await Promise.allSettled([
      generateMechanicsContentStep(activities, expContent.steps, workflowRunId),
      generateQuizContentStep(activities, expContent.steps, workflowRunId),
      generateExamplesContentStep(activities, expContent.steps, workflowRunId),
      generateStoryContentStep(activities, expContent.steps, workflowRunId),
      generateChallengeContentStep(activities, expContent.steps, workflowRunId),
      generateVisualsStep(activities, expContent.steps, "explanation"),
      generateImagesStep(activities, bgVisuals.visuals, "background"),
      generateCustomImagesStep(activities, customVisuals),
    ]);

    await runFinalWaves(activities, workflowRunId, bgContent, expContent, {
      examplesContent: settled(wave3[2], { steps: [] }),
      expVisuals: settled(wave3[5], { visuals: [] }),
      mechContent: settled(wave3[0], { steps: [] }),
      quizContent: settled(wave3[1], { questions: [] }),
    });
  } catch (error) {
    await handleWorkflowFailureStep(lessonId, workflowRunId);
    throw error;
  }
}
