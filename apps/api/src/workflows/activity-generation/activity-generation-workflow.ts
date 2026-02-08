import { FatalError, getWorkflowMetadata } from "workflow";
import { coreActivityWorkflow } from "./core-activity-workflow";
import { customActivityWorkflow } from "./custom-activity-workflow";
import { languageActivityWorkflow } from "./language-activity-workflow";
import { getLessonActivitiesStep } from "./steps/get-lesson-activities-step";
import { handleWorkflowFailureStep } from "./steps/handle-workflow-failure-step";

/**
 * Activity generation workflow.
 *
 * Thin router that determines lesson kind and delegates to the appropriate sub-workflow.
 */
export async function activityGenerationWorkflow(lessonId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  try {
    const activities = await getLessonActivitiesStep(lessonId);
    const firstActivity = activities[0];

    if (!firstActivity) {
      throw new FatalError("No activities found for lesson");
    }

    const lessonKind = firstActivity.lesson.kind;

    if (lessonKind === "language") {
      await languageActivityWorkflow(activities, workflowRunId);
      return;
    }

    if (lessonKind === "custom") {
      await customActivityWorkflow(activities, workflowRunId);
      return;
    }

    await coreActivityWorkflow(activities, workflowRunId);
  } catch (error) {
    await handleWorkflowFailureStep(lessonId, workflowRunId);
    throw error;
  }
}
