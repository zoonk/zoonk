import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import {
  fetchLessonActivities,
  fetchReplacementLessonActivities,
} from "./_utils/fetch-lesson-activities";

export type LessonActivity = Awaited<ReturnType<typeof fetchReplacementLessonActivities>>[number];

/**
 * Load the exact activity set that the current workflow should operate on.
 *
 * Activity generation has two valid scopes:
 * - the live published activities for normal generation
 * - the hidden unpublished replacement activities during regeneration
 *
 * Keeping this as one explicit object input makes that scope obvious at the
 * call site and avoids the old mixed API where some callers passed a bare
 * lesson id and others passed extra flags.
 */
export async function getLessonActivitiesStep(input: {
  lessonId: string;
  regeneration?: boolean;
}): Promise<LessonActivity[]> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "getLessonActivities" });

  const fetchActivities = input.regeneration
    ? () => fetchReplacementLessonActivities({ lessonId: input.lessonId })
    : () => fetchLessonActivities(input.lessonId);

  const { data: activities, error } = await safeAsync(fetchActivities);

  if (error) {
    await stream.error({ reason: "dbFetchFailed", step: "getLessonActivities" });
    throw error;
  }

  if (activities.length === 0) {
    await stream.error({ reason: "noSourceData", step: "getLessonActivities" });
    throw new FatalError("No activities found for lesson");
  }

  await stream.status({ status: "completed", step: "getLessonActivities" });

  return activities;
}
