import { type ActivityStepName } from "@/workflows/config";
import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";

const kindToStepName: Partial<Record<ActivityKind, ActivityStepName>> = {
  background: "setBackgroundAsCompleted",
  challenge: "setChallengeAsCompleted",
  examples: "setExamplesAsCompleted",
  explanation: "setExplanationAsCompleted",
  grammar: "setGrammarAsCompleted",
  languageReview: "setLanguageReviewAsCompleted",
  languageStory: "setLanguageStoryAsCompleted",
  listening: "setListeningAsCompleted",
  mechanics: "setMechanicsAsCompleted",
  quiz: "setQuizAsCompleted",
  reading: "setReadingAsCompleted",
  review: "setReviewAsCompleted",
  story: "setStoryAsCompleted",
  vocabulary: "setVocabularyAsCompleted",
};

export async function completeActivityStep(
  activities: LessonActivity[],
  workflowRunId: string,
  activityKind: ActivityKind,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, activityKind);
  const stepName = kindToStepName[activityKind];

  if (!activity || !stepName) {
    return;
  }

  const current = await prisma.activity.findUnique({
    select: { generationStatus: true },
    where: { id: activity.id },
  });

  if (current?.generationStatus !== "running") {
    return;
  }

  await streamStatus({ status: "started", step: stepName });
  await streamStatus({ status: "started", step: "setActivityAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: workflowRunId, generationStatus: "completed" },
      where: { id: activity.id },
    }),
  );

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: stepName });
    await streamStatus({ status: "error", step: "setActivityAsCompleted" });
    return;
  }

  await streamStatus({ status: "completed", step: stepName });
  await streamStatus({ status: "completed", step: "setActivityAsCompleted" });
}
