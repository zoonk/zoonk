import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedWord } from "./save-vocabulary-words-step";

export async function updateVocabularyEnrichmentsStep(
  activities: LessonActivity[],
  savedWords: SavedWord[],
  pronunciations: Record<string, string>,
  audioUrls: Record<string, string>,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || savedWords.length === 0) {
    return;
  }

  await streamStatus({ status: "started", step: "updateVocabularyEnrichments" });

  const updates = savedWords
    .filter((saved) => pronunciations[saved.word] || audioUrls[saved.word])
    .map((saved) =>
      prisma.word.update({
        data: { audioUrl: audioUrls[saved.word], pronunciation: pronunciations[saved.word] },
        where: { id: saved.wordId },
      }),
    );

  const { error } = await safeAsync(() => prisma.$transaction(updates));

  if (error) {
    await streamStatus({ status: "error", step: "updateVocabularyEnrichments" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await streamStatus({ status: "completed", step: "updateVocabularyEnrichments" });
}
