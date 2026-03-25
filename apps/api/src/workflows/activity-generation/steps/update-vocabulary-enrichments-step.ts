import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedWord } from "./save-vocabulary-words-step";

export async function updateVocabularyEnrichmentsStep(
  activities: LessonActivity[],
  savedWords: SavedWord[],
  pronunciations: Record<string, string>,
  wordAudioIds: Record<string, bigint>,
  romanizations: Record<string, string>,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || savedWords.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "updateVocabularyEnrichments" });

  const updates = savedWords
    .filter(
      (saved) =>
        pronunciations[saved.word] || wordAudioIds[saved.word] || romanizations[saved.word],
    )
    .map((saved) =>
      prisma.word.update({
        data: {
          pronunciation: pronunciations[saved.word],
          romanization: romanizations[saved.word],
          wordAudioId: wordAudioIds[saved.word],
        },
        where: { id: saved.wordId },
      }),
    );

  const { error } = await safeAsync(() => prisma.$transaction(updates));

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "updateVocabularyEnrichments" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await stream.status({ status: "completed", step: "updateVocabularyEnrichments" });
}
