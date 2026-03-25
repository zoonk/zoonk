import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentenceWord } from "./save-sentence-words-step";

export async function updateSentenceWordEnrichmentsStep(
  activities: LessonActivity[],
  savedSentenceWords: SavedSentenceWord[],
  wordAudioIds: Record<string, bigint>,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentenceWords.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "updateSentenceWordEnrichments" });

  const updates = savedSentenceWords
    .filter((saved) => wordAudioIds[saved.word])
    .map((saved) =>
      prisma.word.update({
        data: { wordAudioId: wordAudioIds[saved.word] },
        where: { id: saved.wordId },
      }),
    );

  const { error } = await safeAsync(() => prisma.$transaction(updates));

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "updateSentenceWordEnrichments" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await stream.status({ status: "completed", step: "updateSentenceWordEnrichments" });
}
