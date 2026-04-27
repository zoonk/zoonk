import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { fetchLessonActivities } from "./_utils/fetch-lesson-activities";

export type LessonActivity = Awaited<ReturnType<typeof fetchLessonActivities>>[number];

/**
 * Load the exact activity set that the current workflow should operate on.
 *
 * Keeping this as an object input makes the call site explicit and leaves room
 * for future generation filters without returning to a positional API.
 */
export async function getLessonActivitiesStep(input: {
  lessonId: string;
}): Promise<LessonActivity[]> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "getLessonActivities" });

  const { data: activities, error } = await safeAsync(() => fetchLessonActivities(input.lessonId));

  if (error) {
    throw error;
  }

  if (activities.length === 0) {
    throw new FatalError("No activities found for lesson");
  }

  await stream.status({ status: "completed", step: "getLessonActivities" });

  return activities;
}
