import { type ActivityKind } from "@zoonk/db";
import { FatalError, getWorkflowMetadata } from "workflow";
import { coreActivityWorkflow } from "./core-activity-workflow";
import { customActivityWorkflow } from "./custom-activity-workflow";
import { languageActivityWorkflow } from "./language-activity-workflow";
import { completeActivityStep } from "./steps/complete-activity-step";
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

    const allCompleted = activities.every((a) => a.generationStatus === "completed");

    /**
     * All activities are already completed — stream the completion events
     * so the client can detect this and redirect to the activity page.
     */
    if (allCompleted) {
      const uniqueKinds = [...new Set(activities.map((a) => a.kind))] as ActivityKind[];

      await Promise.allSettled(
        uniqueKinds.map((kind) => completeActivityStep(activities, workflowRunId, kind)),
      );

      return;
    }

    /**
     * Skip if all remaining activities are either completed or actively running.
     * "running" means another workflow instance is generating them — we skip
     * to avoid conflicts. We only proceed when at least one is "pending" or "failed".
     */
    const allHandled = activities.every(
      (a) => a.generationStatus === "completed" || a.generationStatus === "running",
    );

    if (allHandled) {
      return;
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
