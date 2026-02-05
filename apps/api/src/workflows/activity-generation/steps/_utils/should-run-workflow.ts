import { type LessonActivity } from "../get-lesson-activities-step";

/**
 * Determines what action a workflow should take based on activity status.
 *
 * @returns "generate" - Activity needs content generation
 * @returns "notifyOnly" - Already completed, just notify dependents
 * @returns "skip" - Already running or doesn't exist
 */
export function getWorkflowAction(
  activity: LessonActivity | undefined,
): "generate" | "notifyOnly" | "skip" {
  if (!activity) {
    return "skip";
  }

  // Already completed with steps - just notify dependents (they might be waiting)
  if (activity.generationStatus === "completed" && activity._count.steps > 0) {
    return "notifyOnly";
  }

  // Already running - skip to avoid duplicate work
  if (activity.generationStatus === "running") {
    return "skip";
  }

  return "generate";
}
