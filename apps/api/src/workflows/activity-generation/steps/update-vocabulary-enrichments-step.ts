import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedWord } from "./save-vocabulary-words-step";

/**
 * Updates Word-level fields (audioUrl and romanization) after parallel
 * generation. WordTranslation-level fields (pronunciation,
 * alternativeTranslations) are handled by
 * generateWordPronunciationAndAlternatives, so this step only writes
 * to the Word table.
 */
export async function updateVocabularyEnrichmentsStep(
  activities: LessonActivity[],
  savedWords: SavedWord[],
  wordAudioUrls: Record<string, string>,
  romanizations: Record<string, string>,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || savedWords.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "updateVocabularyEnrichments" });

  const wordUpdates = savedWords
    .filter((saved) => wordAudioUrls[saved.word] || romanizations[saved.word])
    .map((saved) =>
      prisma.word.update({
        data: {
          audioUrl: wordAudioUrls[saved.word],
          romanization: romanizations[saved.word],
        },
        where: { id: saved.wordId },
      }),
    );

  const { error } = await safeAsync(() => prisma.$transaction(wordUpdates));

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "updateVocabularyEnrichments" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await stream.status({ status: "completed", step: "updateVocabularyEnrichments" });
}
