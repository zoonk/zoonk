import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function copyLanguageReviewStepsStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<void> {
  "use step";

  const languageReview = findActivityByKind(activities, "languageReview");

  if (!languageReview) {
    return;
  }

  const current = await prisma.activity.findUnique({
    select: { generationStatus: true },
    where: { id: languageReview.id },
  });

  if (current?.generationStatus === "completed" || current?.generationStatus === "running") {
    return;
  }

  if (current?.generationStatus === "failed") {
    await safeAsync(() => prisma.step.deleteMany({ where: { activityId: languageReview.id } }));
  }

  const vocabulary = findActivityByKind(activities, "vocabulary");
  const reading = findActivityByKind(activities, "reading");

  const vocabularySteps = vocabulary
    ? await prisma.step.findMany({
        orderBy: { position: "asc" },
        select: { position: true, wordId: true },
        where: { activityId: vocabulary.id, kind: "vocabulary" },
      })
    : [];

  const readingSteps = reading
    ? await prisma.step.findMany({
        orderBy: { position: "asc" },
        select: { position: true, sentenceId: true },
        where: { activityId: reading.id, kind: "reading" },
      })
    : [];

  if (vocabularySteps.length === 0 && readingSteps.length === 0) {
    await streamError({ reason: "noSourceData", step: "copyLanguageReviewSteps" });
    await handleActivityFailureStep({ activityId: languageReview.id });
    return;
  }

  await setActivityAsRunningStep({
    activityId: languageReview.id,
    workflowRunId,
  });

  await streamStatus({ status: "started", step: "copyLanguageReviewSteps" });

  const vocabData = vocabularySteps.map((step, idx) => ({
    activityId: languageReview.id,
    content: assertStepContent("vocabulary", {}),
    kind: "vocabulary" as const,
    position: idx,
    wordId: step.wordId,
  }));

  const readingData = readingSteps.map((step, idx) => ({
    activityId: languageReview.id,
    content: assertStepContent("reading", {}),
    kind: "reading" as const,
    position: vocabularySteps.length + idx,
    sentenceId: step.sentenceId,
  }));

  const { error } = await safeAsync(() =>
    prisma.step.createMany({ data: [...vocabData, ...readingData] }),
  );

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "copyLanguageReviewSteps" });
    await handleActivityFailureStep({ activityId: languageReview.id });
    return;
  }

  await streamStatus({ status: "completed", step: "copyLanguageReviewSteps" });
}
