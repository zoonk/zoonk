import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type VocabularyWord } from "./generate-vocabulary-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type SavedWord = {
  word: string;
  wordId: number;
};

async function saveOneWord(
  vocabWord: VocabularyWord,
  activityId: number,
  lessonId: number,
  organizationId: number,
  targetLanguage: string,
  userLanguage: string,
  position: number,
): Promise<SavedWord> {
  const record = await prisma.word.upsert({
    create: {
      organizationId,
      romanization: vocabWord.romanization,
      targetLanguage,
      translation: vocabWord.translation,
      userLanguage,
      word: vocabWord.word,
    },
    update: {
      romanization: vocabWord.romanization,
      translation: vocabWord.translation,
    },
    where: {
      orgWord: { organizationId, targetLanguage, userLanguage, word: vocabWord.word },
    },
  });

  const wordId = record.id;

  await prisma.lessonWord.upsert({
    create: { lessonId, wordId },
    update: {},
    where: { lessonWord: { lessonId, wordId } },
  });

  await prisma.step.create({
    data: {
      activityId,
      content: { text: vocabWord.translation, title: vocabWord.word },
      kind: "static",
      position,
      wordId,
    },
  });

  return { word: vocabWord.word, wordId: Number(wordId) };
}

export async function saveVocabularyWordsStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
): Promise<{ savedWords: SavedWord[] }> {
  "use step";

  const activity = activities.find((act) => act.kind === "vocabulary");

  if (!activity || words.length === 0) {
    return { savedWords: [] };
  }

  await streamStatus({ status: "started", step: "saveVocabularyWords" });

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;
  const organizationId = course.organization.id;

  const { data: savedWords, error } = await safeAsync(() =>
    Promise.all(
      words.map((vocabWord, index) =>
        saveOneWord(
          vocabWord,
          activity.id,
          activity.lessonId,
          organizationId,
          targetLanguage,
          userLanguage,
          index,
        ),
      ),
    ),
  );

  if (error) {
    await streamStatus({ status: "error", step: "saveVocabularyWords" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { savedWords: [] };
  }

  await streamStatus({ status: "completed", step: "saveVocabularyWords" });
  return { savedWords };
}
