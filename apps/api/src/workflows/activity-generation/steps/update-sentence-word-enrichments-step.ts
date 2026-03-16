import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentenceWord } from "./save-sentence-words-step";

export async function updateSentenceWordEnrichmentsStep(
  activities: LessonActivity[],
  savedSentenceWords: SavedSentenceWord[],
  wordAudioUrls: Record<string, string>,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentenceWords.length === 0) {
    return;
  }

  await streamStatus({ status: "started", step: "updateSentenceWordEnrichments" });

  const updates = savedSentenceWords
    .filter((saved) => wordAudioUrls[saved.word])
    .map((saved) =>
      prisma.word.update({
        data: { audioUrl: wordAudioUrls[saved.word] },
        where: { id: saved.wordId },
      }),
    );

  const { error } = await safeAsync(() => prisma.$transaction(updates));

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "updateSentenceWordEnrichments" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await streamStatus({ status: "completed", step: "updateSentenceWordEnrichments" });
}
