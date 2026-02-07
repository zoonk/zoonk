import { getWorkflowMetadata } from "workflow";
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
import { getLessonActivitiesStep } from "./steps/get-lesson-activities-step";
import { handleWorkflowFailureStep } from "./steps/handle-workflow-failure-step";
import { saveActivityStep } from "./steps/save-activity-step";

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

/**
 * Activity generation workflow.
 *
 * Linear workflow with parallel batches where dependencies allow.
 * Steps save data to DB immediately after generation (for resumption).
 * Steps query DB to check for existing data before generating (skip completed work).
 *
 * Dependency graph:
 * background (no deps) → explanation → mechanics
 *                                   → quiz
 *                                   → examples
 *                                   → story
 *                                   → challenge
 * review (needs background + explanation + mechanics + examples)
 *
 * Wave structure:
 * 1. background content
 * 2. explanation content + background visuals (parallel)
 * 3. mechanics content + quiz content + examples content + story content + challenge content + explanation visuals + background images (parallel)
 * 4. review content + mechanics visuals + examples visuals + quiz images + explanation images + save background + save story + save challenge (parallel)
 * 5. mechanics images + examples images + save explanation + save quiz + save review (parallel)
 * 6. save mechanics + save examples
 */
export async function activityGenerationWorkflow(lessonId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  try {
    const activities = await getLessonActivitiesStep(lessonId);

    // Wave 1: background content (no dependencies)
    const bgContent = await generateBackgroundContentStep(activities, workflowRunId);

    // Wave 2: explanation content (needs background) + background visuals (parallel)
    const [expContentResult, bgVisualsResult] = await Promise.allSettled([
      generateExplanationContentStep(activities, bgContent.steps, workflowRunId),
      generateVisualsStep(activities, bgContent.steps, "background"),
    ]);

    const expContent = settled(expContentResult, { steps: [] });
    const bgVisuals = settled(bgVisualsResult, { visuals: [] });

    // Wave 3: mechanics + quiz + examples + story + challenge content (need explanation) + explanation visuals + background images (parallel)
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

    // Wave 4: review content + mechanics visuals + examples visuals + quiz images + explanation images + save background + save story + save challenge (parallel)
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
      saveActivityStep(activities, workflowRunId, "background"),
      saveActivityStep(activities, workflowRunId, "story"),
      saveActivityStep(activities, workflowRunId, "challenge"),
    ]);

    const mechVisuals = settled(mechVisualsResult, { visuals: [] });
    const examplesVisuals = settled(examplesVisualsResult, { visuals: [] });

    // Wave 5: mechanics images + examples images + save explanation + save quiz + save review (parallel)
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
  } catch (error) {
    await handleWorkflowFailureStep(lessonId, workflowRunId);
    throw error;
  }
}
