import { generateActivityPronunciation } from "@zoonk/ai/tasks/activities/language/pronunciation";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type VocabularyWord } from "./generate-vocabulary-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";

async function generatePronunciation(
  word: string,
  nativeLanguage: string,
  targetLanguage: string,
): Promise<{ pronunciation: string; word: string } | null> {
  const { data: result, error } = await safeAsync(() =>
    generateActivityPronunciation({ nativeLanguage, targetLanguage, word }),
  );

  if (error || !result) {
    return null;
  }

  const output = result.data;

  if (!output) {
    return null;
  }

  return { pronunciation: output.pronunciation, word };
}

export async function generateVocabularyPronunciationStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<{ pronunciations: Record<string, string> }> {
  "use step";

  const activity = activities.find((act) => act.kind === "vocabulary");

  if (!activity || words.length === 0) {
    return { pronunciations: {} };
  }

  await streamStatus({ status: "started", step: "generateVocabularyPronunciation" });

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? "";
  const nativeLanguage = activity.language;

  const results = await Promise.allSettled(
    words.map((vocabWord) => generatePronunciation(vocabWord.word, nativeLanguage, targetLanguage)),
  );

  const pronunciations: Record<string, string> = {};

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      pronunciations[result.value.word] = result.value.pronunciation;
    }
  }

  await streamStatus({ status: "completed", step: "generateVocabularyPronunciation" });
  return { pronunciations };
}
