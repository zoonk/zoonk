import { FatalError, getWorkflowMetadata } from "workflow";
import { coreActivityWorkflow } from "./core-activity-workflow";
import { customActivityWorkflow } from "./custom-activity-workflow";
import { languageActivityWorkflow } from "./language-activity-workflow";
import { getLessonActivitiesStep } from "./steps/get-lesson-activities-step";
import { handleWorkflowFailureStep } from "./steps/handle-workflow-failure-step";
import { markAllActivitiesAsRunningStep } from "./steps/mark-all-activities-as-running-step";
import { streamCompletionEventsStep } from "./steps/stream-completion-events-step";

/**
 * Activity generation workflow.
 *
 * Thin router that determines lesson kind and delegates to the appropriate sub-workflow.
 * Decides up front which activities need generation (pending/failed) vs which are
 * already completed, so downstream generate steps never check generationStatus.
 */
export async function activityGenerationWorkflow(
  lessonId: number,
  options: {
    regeneration?: boolean;
  } = {},
): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  try {
    const activities = await getLessonActivitiesStep({
      lessonId,
      regeneration: options.regeneration,
    });

    const firstActivity = activities[0];

    if (!firstActivity) {
      throw new FatalError("No activities found for lesson");
    }

    const completedActivities = activities.filter((a) => a.generationStatus === "completed");

    /**
     * All activities are already completed — stream the completion events
     * so the client can detect this and redirect to the activity page.
     */
    if (completedActivities.length === activities.length) {
      const uniqueKinds = [...new Set(activities.map((a) => a.kind))];

      await Promise.allSettled(
        uniqueKinds.map((kind) => streamCompletionEventsStep(activities, kind)),
      );

      return;
    }

    const activitiesToGenerate = activities.filter(
      (a) => a.generationStatus === "pending" || a.generationStatus === "failed",
    );

    /**
     * Skip if all remaining activities are either completed or actively running.
     * "running" means another workflow instance is generating them — we skip
     * to avoid conflicts. We only proceed when at least one is "pending" or "failed".
     */
    if (activitiesToGenerate.length === 0) {
      return;
    }

    /**
     * Mark only activities that need generation as "running" in one batch
     * before any generation begins. This prevents a race condition where a user
     * navigates to a still-"pending" activity and triggers a duplicate workflow.
     * Also deletes existing steps for failed activities so they start fresh.
     */
    await markAllActivitiesAsRunningStep({ activities: activitiesToGenerate, workflowRunId });

    const lessonKind = firstActivity.lesson.kind;

    if (lessonKind === "language") {
      await languageActivityWorkflow({
        activitiesToGenerate,
        allActivities: activities,
        workflowRunId,
      });
      return;
    }

    if (lessonKind === "custom") {
      await customActivityWorkflow({
        activitiesToGenerate,
        workflowRunId,
      });
      return;
    }

    await coreActivityWorkflow({
      activitiesToGenerate,
      allActivities: activities,
      workflowRunId,
    });
  } catch (error) {
    if (!options.regeneration) {
      await handleWorkflowFailureStep({ lessonId });
    }

    throw error;
  }
}
