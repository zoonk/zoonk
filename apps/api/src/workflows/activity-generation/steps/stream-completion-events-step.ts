import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName, getActivityCompletionStep } from "@zoonk/core/workflows/steps";
import { type ActivityKind } from "@zoonk/db";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Streams completion SSE events for activities that are already completed.
 * Used when the workflow starts and finds all activities already done —
 * the UI needs the SSE events to detect completion and redirect.
 *
 * No DB writes. This is purely for the client-side SSE protocol.
 * For the normal generation flow, each save step handles its own
 * completion events.
 */
export async function streamCompletionEventsStep(
  activities: LessonActivity[],
  activityKind: ActivityKind,
): Promise<void> {
  "use step";

  const matchingActivities = findActivitiesByKind(activities, activityKind);
  const stepName = getActivityCompletionStep(activityKind);

  if (matchingActivities.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "completed", step: stepName });
}
