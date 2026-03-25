import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { rejected } from "@zoonk/utils/settled";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

const kindToStepName: Partial<Record<ActivityKind, ActivityStepName>> = {
  challenge: "setChallengeAsCompleted",
  explanation: "setExplanationAsCompleted",
  grammar: "setGrammarAsCompleted",
  listening: "setListeningAsCompleted",
  practice: "setPracticeAsCompleted",
  quiz: "setQuizAsCompleted",
  reading: "setReadingAsCompleted",
  translation: "setTranslationAsCompleted",
  vocabulary: "setVocabularyAsCompleted",
};

async function completeSingleActivity(
  activity: LessonActivity,
  workflowRunId: string,
): Promise<void> {
  const current = await prisma.activity.findUnique({
    where: { id: activity.id },
  });

  if (current?.generationStatus !== "running") {
    return;
  }

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { id: activity.id },
    }),
  );

  if (error) {
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }
}

export async function completeActivityStep(
  activities: LessonActivity[],
  workflowRunId: string,
  activityKind: ActivityKind,
): Promise<void> {
  "use step";

  const matchingActivities = findActivitiesByKind(activities, activityKind);
  const stepName = kindToStepName[activityKind];

  if (matchingActivities.length === 0 || !stepName) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: stepName });
  await stream.status({ status: "started", step: "setActivityAsCompleted" });

  const allSettled = await Promise.allSettled(
    matchingActivities.map((activity) => completeSingleActivity(activity, workflowRunId)),
  );

  const status = rejected(allSettled) ? "error" : "completed";

  await stream.status({ status, step: stepName });
  await stream.status({ status, step: "setActivityAsCompleted" });

  const hasFirstActivity = matchingActivities.some((a) => a.position === 0);

  if (hasFirstActivity) {
    await stream.status({ status, step: "setFirstActivityAsCompleted" });
  }
}
