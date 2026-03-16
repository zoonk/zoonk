import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentenceWord } from "./save-sentence-words-step";

async function generateAudioForWord(
  word: string,
  language: string,
  orgSlug?: string,
): Promise<{ audioUrl: string; word: string } | null> {
  const { data, error } = await generateLanguageAudio({
    language,
    orgSlug,
    text: word,
  });

  if (error || !data) {
    return null;
  }

  return { audioUrl: data, word };
}

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

  const results = await Promise.all(
    savedSentenceWords.map((saved) => generateAudioForWord(saved.word, targetLanguage, orgSlug)),
  );

  const fulfilled = results.filter((result) => result !== null);

  const wordAudioUrls: Record<string, string> = Object.fromEntries(
    fulfilled.map(({ word, audioUrl }) => [word, audioUrl]),
  );

  if (fulfilled.length < savedSentenceWords.length) {
    await streamError({ reason: "enrichmentFailed", step: "generateSentenceWordAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { wordAudioUrls };
  }

  await streamStatus({ status: "completed", step: "generateSentenceWordAudio" });
  return { wordAudioUrls };
}
