import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

export async function updateReadingEnrichmentsStep(
  activities: LessonActivity[],
  savedSentences: SavedSentence[],
  audioUrls: Record<string, string>,
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentences.length === 0) {
    return;
  }

  await streamStatus({ status: "started", step: "updateSentenceEnrichments" });

  const updates = savedSentences
    .filter((saved) => audioUrls[saved.sentence])
    .map((saved) =>
      prisma.sentence.update({
        data: { audioUrl: audioUrls[saved.sentence] },
        where: { id: saved.sentenceId },
      }),
    );

  const { error } = await safeAsync(() => prisma.$transaction(updates));

  if (error) {
    await streamStatus({ status: "error", step: "updateSentenceEnrichments" });
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  await streamStatus({ status: "completed", step: "updateSentenceEnrichments" });
}
