import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentenceWord } from "./save-sentence-words-step";

export async function generateSentenceWordAudioStep(
  activities: LessonActivity[],
  savedSentenceWords: SavedSentenceWord[],
): Promise<{ wordAudioUrls: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "reading");

  if (!activity || savedSentenceWords.length === 0) {
    return { wordAudioUrls: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await streamStatus({ status: "started", step: "generateSentenceWordAudio" });

  if (!isTTSSupportedLanguage(targetLanguage)) {
    await streamStatus({ status: "completed", step: "generateSentenceWordAudio" });
    return { wordAudioUrls: {} };
  }

  const orgSlug = course.organization?.slug;

  const wordsNeedingAudio = savedSentenceWords.filter((saved) => !saved.audioUrl);
  const existingAudioUrls: Record<string, string> = Object.fromEntries(
    savedSentenceWords.flatMap((saved) => (saved.audioUrl ? [[saved.word, saved.audioUrl]] : [])),
  );

  const results = await Promise.all(
    wordsNeedingAudio.map((saved) => generateAudioForText(saved.word, targetLanguage, orgSlug)),
  );

  const fulfilled = results.filter((result) => result !== null);

  const wordAudioUrls: Record<string, string> = {
    ...existingAudioUrls,
    ...Object.fromEntries(fulfilled.map(({ text, audioUrl }) => [text, audioUrl])),
  };

  if (fulfilled.length < wordsNeedingAudio.length) {
    await streamError({ reason: "enrichmentFailed", step: "generateSentenceWordAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { wordAudioUrls };
  }

  await streamStatus({ status: "completed", step: "generateSentenceWordAudio" });
  return { wordAudioUrls };
}
