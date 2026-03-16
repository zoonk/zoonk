import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

export async function generateReadingAudioStep(
  activities: LessonActivity[],
  savedSentences: SavedSentence[],
): Promise<{ audioUrls: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentences.length === 0) {
    return { audioUrls: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await streamStatus({ status: "started", step: "generateAudio" });

  if (!isTTSSupportedLanguage(targetLanguage)) {
    await streamStatus({ status: "completed", step: "generateAudio" });
    return { audioUrls: {} };
  }

  const results = await Promise.all(
    savedSentences.map((saved) =>
      generateAudioForText(saved.sentence, targetLanguage, course.organization?.slug),
    ),
  );

  const fulfilled = results.filter((result) => result !== null);

  const audioUrls: Record<string, string> = Object.fromEntries(
    fulfilled.map(({ text, audioUrl }) => [text, audioUrl]),
  );

  if (fulfilled.length < savedSentences.length) {
    await streamError({ reason: "enrichmentFailed", step: "generateAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { audioUrls };
  }

  await streamStatus({ status: "completed", step: "generateAudio" });
  return { audioUrls };
}
