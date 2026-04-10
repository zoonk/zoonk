import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { fetchLessonActivities } from "./_utils/fetch-lesson-activities";

export type LessonActivity = Awaited<ReturnType<typeof fetchLessonActivities>>[number];

export async function getLessonActivitiesStep(lessonId: number): Promise<LessonActivity[]> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "getLessonActivities" });

  const { data: activities, error } = await safeAsync(() => fetchLessonActivities(lessonId));

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
