import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Creates translation steps from an already-completed vocabulary activity.
 *
 * This handles the edge case where vocabulary completed on a prior run but
 * translation failed. On retry, vocabulary is NOT in activitiesToGenerate
 * (it's already completed), so vocabularyActivityWorkflow returns early
 * and never creates translation steps. This step reads the existing
 * vocabulary steps from the DB and creates matching translation steps.
 *
 * Uses the "saveVocabularyActivity" SSE step name because that's the
 * completion signal the UI expects for both vocabulary and translation
 * activities (see `getActivityCompletionStep` in @zoonk/core).
 */
export async function saveTranslationFromExistingVocabularyStep({
  allActivities,
  workflowRunId,
}: {
  allActivities: LessonActivity[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  const vocabularyActivity = findActivityByKind(allActivities, "vocabulary");
  const translationActivity = findActivityByKind(allActivities, "translation");

  if (!vocabularyActivity || !translationActivity) {
    return;
  }

  await using stream = createEntityStepStream<ActivityStepName>(translationActivity.id);

  await stream.status({ status: "started", step: "saveVocabularyActivity" });

  const vocabularySteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: { activityId: vocabularyActivity.id, kind: "vocabulary" },
  });

  if (vocabularySteps.length === 0) {
    await stream.error({ reason: "noSourceData", step: "saveVocabularyActivity" });
    await handleActivityFailureStep({ activityId: translationActivity.id });
    return;
  }

  const translationStepData = vocabularySteps.map((step) => ({
    activityId: translationActivity.id,
    content: assertStepContent("translation", {}),
    isPublished: true,
    kind: "translation" as const,
    position: step.position,
    wordId: step.wordId,
  }));

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({ data: translationStepData }),
      prisma.activity.update({
        data: { generationRunId: workflowRunId, generationStatus: "completed" },
        where: { id: translationActivity.id },
      }),
    ]),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "saveVocabularyActivity" });
    await handleActivityFailureStep({ activityId: translationActivity.id });
    return;
  }

  await stream.status({ status: "completed", step: "saveVocabularyActivity" });
}
