import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamStatus } from "../stream-status";
import { type VocabularyWord } from "./generate-vocabulary-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";

async function generateAudioForWord(
  word: string,
  language: string,
  orgSlug: string,
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

export async function generateVocabularyAudioStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<{ audioUrls: Record<string, string> }> {
  "use step";

  const activity = activities.find((act) => act.kind === "vocabulary");

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

  const results = await Promise.allSettled(
    words.map((vocabWord) => generateAudioForWord(vocabWord.word, targetLanguage, orgSlug)),
  );

  const audioUrls: Record<string, string> = {};

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      audioUrls[result.value.word] = result.value.audioUrl;
    }
  }

  await streamStatus({ status: "completed", step: "generateVocabularyAudio" });
  return { audioUrls };
}
