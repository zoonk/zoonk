import { getWorkflowMetadata } from "workflow";
import { generateBackgroundContentStep } from "./steps/generate-background-content-step";
import { generateExplanationContentStep } from "./steps/generate-explanation-content-step";
import { generateImagesStep } from "./steps/generate-images-step";
import { generateMechanicsContentStep } from "./steps/generate-mechanics-content-step";
import { generateQuizContentStep } from "./steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "./steps/generate-quiz-images-step";
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
 *
 * Wave structure:
 * 1. background content
 * 2. explanation content + background visuals (parallel)
 * 3. mechanics content + quiz content + explanation visuals + background images (parallel)
 * 4. mechanics visuals + quiz images + explanation images + save background (parallel)
 * 5. mechanics images + save explanation + save quiz (parallel)
 * 6. save mechanics
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

    // Wave 3: mechanics + quiz content (need explanation) + explanation visuals + background images (parallel)
    const [mechContentResult, quizContentResult, expVisualsResult] = await Promise.allSettled([
      generateMechanicsContentStep(activities, expContent.steps, workflowRunId),
      generateQuizContentStep(activities, expContent.steps, workflowRunId),
      generateVisualsStep(activities, expContent.steps, "explanation"),
      generateImagesStep(activities, bgVisuals.visuals, "background"),
    ]);

    const mechContent = settled(mechContentResult, { steps: [] });
    const quizContent = settled(quizContentResult, { questions: [] });
    const expVisuals = settled(expVisualsResult, { visuals: [] });

    // Wave 4: mechanics visuals + quiz images + explanation images + save background (parallel)
    const [mechVisualsResult] = await Promise.allSettled([
      generateVisualsStep(activities, mechContent.steps, "mechanics"),
      generateQuizImagesStep(activities, quizContent.questions),
      generateImagesStep(activities, expVisuals.visuals, "explanation"),
      saveActivityStep(activities, workflowRunId, "background"),
    ]);

    const mechVisuals = settled(mechVisualsResult, { visuals: [] });

    // Wave 5: mechanics images + save explanation + save quiz (parallel)
    await Promise.allSettled([
      generateImagesStep(activities, mechVisuals.visuals, "mechanics"),
      saveActivityStep(activities, workflowRunId, "explanation"),
      saveActivityStep(activities, workflowRunId, "quiz"),
    ]);

    // Wave 6: save mechanics
    await saveActivityStep(activities, workflowRunId, "mechanics");
  } catch (error) {
    await handleWorkflowFailureStep(lessonId, workflowRunId);
    throw error;
  }
}
