import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { type SavedSentence } from "./save-reading-sentences-step";

async function generateAudioForSentence(
  sentence: string,
  language: string,
  orgSlug: string,
): Promise<{ audioUrl: string; sentence: string } | null> {
  const { data, error } = await generateLanguageAudio({
    language,
    orgSlug,
    text: sentence,
  });

  if (error || !data) {
    return null;
  }

  return { audioUrl: data, sentence };
}

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
    savedSentences.map((savedSentence) =>
      generateAudioForSentence(savedSentence.sentence, targetLanguage, course.organization.slug),
    ),
  );

  const fulfilled = results.filter((result) => result !== null);

  const audioUrls: Record<string, string> = Object.fromEntries(
    fulfilled.map(({ sentence, audioUrl }) => [sentence, audioUrl]),
  );

  if (fulfilled.length < savedSentences.length) {
    await streamStatus({ status: "error", step: "generateAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { audioUrls };
  }

  await streamStatus({ status: "completed", step: "generateAudio" });
  return { audioUrls };
}
