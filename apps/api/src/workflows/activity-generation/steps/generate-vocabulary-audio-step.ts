import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type VocabularyWord } from "./generate-vocabulary-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

async function generateAudioForWord(
  word: string,
  orgSlug: string,
): Promise<{ audioUrl: string; word: string } | null> {
  const { data, error } = await generateLanguageAudio({
    orgSlug,
    text: word,
  });

  if (error || !data) {
    return null;
  }

  return { audioUrl: data, word };
}

export async function generateVocabularyAudioStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<{ audioUrls: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || words.length === 0) {
    return { audioUrls: {} };
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await streamStatus({ status: "started", step: "generateVocabularyAudio" });

  if (!isTTSSupportedLanguage(targetLanguage)) {
    await streamStatus({ status: "completed", step: "generateVocabularyAudio" });
    return { audioUrls: {} };
  }

  const orgSlug = course.organization.slug;

  const results = await Promise.all(
    words.map((vocabWord) => generateAudioForWord(vocabWord.word, orgSlug)),
  );

  const fulfilled = results.filter((result) => result !== null);

  const audioUrls: Record<string, string> = Object.fromEntries(
    fulfilled.map(({ word, audioUrl }) => [word, audioUrl]),
  );

  if (fulfilled.length < words.length) {
    await streamStatus({ status: "error", step: "generateVocabularyAudio" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { audioUrls };
  }

  await streamStatus({ status: "completed", step: "generateVocabularyAudio" });
  return { audioUrls };
}
