import { prisma } from "@zoonk/db";
import { streamError } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { completeActivityStep } from "./complete-activity-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export async function completeListeningActivityStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  "use step";

  const listening = findActivityByKind(activities, "listening");

  if (!listening) {
    return;
  }

  const reading = findActivityByKind(activities, "reading");

  if (!reading) {
    await streamError({ reason: "noSourceData", step: "setListeningAsCompleted" });
    await handleActivityFailureStep({ activityId: listening.id });
    return;
  }

  const readingActivity = await prisma.activity.findUnique({
    select: { generationStatus: true },
    where: { id: reading.id },
  });

  if (readingActivity?.generationStatus !== "failed") {
    await completeActivityStep(activities, workflowRunId, "listening");
    return;
  }

  await streamError({ reason: "noSourceData", step: "setListeningAsCompleted" });
  await handleActivityFailureStep({ activityId: listening.id });
}
