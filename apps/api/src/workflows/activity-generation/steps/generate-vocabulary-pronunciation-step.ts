import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type VocabularyWord } from "./generate-vocabulary-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

async function generatePronunciation(
  word: string,
  userLanguage: string,
  targetLanguage: string,
): Promise<{ pronunciation: string; word: string } | null> {
  const { data: result, error } = await safeAsync(() =>
    generateActivityPronunciation({ targetLanguage, userLanguage, word }),
  );

  if (error || !result?.data) {
    return null;
  }

  return { pronunciation: result.data.pronunciation, word };
}

export async function generateVocabularyPronunciationStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<{ pronunciations: Record<string, string> }> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity || words.length === 0) {
    return { pronunciations: {} };
  }

  await streamStatus({ status: "started", step: "generateVocabularyPronunciation" });

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;

  const results = await Promise.all(
    words.map((vocabWord) => generatePronunciation(vocabWord.word, userLanguage, targetLanguage)),
  );

  const fulfilled = results.filter((result) => result !== null);

  const pronunciations: Record<string, string> = Object.fromEntries(
    fulfilled.map(({ word, pronunciation }) => [word, pronunciation]),
  );

  if (fulfilled.length < words.length) {
    await streamStatus({ status: "error", step: "generateVocabularyPronunciation" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { pronunciations };
  }

  await streamStatus({ status: "completed", step: "generateVocabularyPronunciation" });
  return { pronunciations };
}
