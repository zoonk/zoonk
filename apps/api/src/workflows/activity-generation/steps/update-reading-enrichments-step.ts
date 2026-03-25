import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

export async function updateReadingEnrichmentsStep(
  activities: LessonActivity[],
  savedSentences: SavedSentence[],
  sentenceAudioIds: Record<string, bigint>,
  romanizations: Record<string, string>,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentences.length === 0) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "updateSentenceEnrichments" });

  const updates = savedSentences
    .filter((saved) => sentenceAudioIds[saved.sentence] || romanizations[saved.sentence])
    .map((saved) =>
      prisma.sentence.update({
        data: {
          romanization: romanizations[saved.sentence],
          sentenceAudioId: sentenceAudioIds[saved.sentence],
        },
        where: { id: saved.sentenceId },
      }),
    );

  const { error } = await safeAsync(() => prisma.$transaction(updates));

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "updateSentenceEnrichments" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await stream.status({ status: "completed", step: "updateSentenceEnrichments" });
}
