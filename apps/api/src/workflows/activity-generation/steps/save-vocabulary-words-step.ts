import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizePunctuation } from "@zoonk/utils/string";
import { fetchExistingWordCasing } from "./_utils/fetch-existing-word-casing";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export type SavedWord = {
  word: string;
  wordId: number;
};

function buildSaveOneWord(params: {
  existingCasing: Record<string, string>;
  vocabularyActivityId: number;
  translationActivityId: number | null;
  lessonId: number;
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
}) {
  const {
    existingCasing,
    vocabularyActivityId,
    translationActivityId,
    lessonId,
    organizationId,
    targetLanguage,
    userLanguage,
  } = params;

  return async (vocabWord: VocabularyWord, position: number): Promise<SavedWord> => {
    const translation = normalizePunctuation(vocabWord.translation);
    const dbWord = existingCasing[vocabWord.word.toLowerCase()] ?? vocabWord.word;

    const record = await prisma.word.upsert({
      create: {
        organizationId,
        targetLanguage,
        word: dbWord,
      },
      update: {},
      where: {
        orgWord: { organizationId, targetLanguage, word: dbWord },
      },
    });

    const wordId = record.id;

    await prisma.wordTranslation.upsert({
      create: {
        translation,
        userLanguage,
        wordId,
      },
      update: {
        translation,
      },
      where: {
        wordTranslation: { userLanguage, wordId },
      },
    });

    await prisma.lessonWord.upsert({
      create: { lessonId, wordId },
      update: {},
      where: { lessonWord: { lessonId, wordId } },
    });

    await prisma.step.create({
      data: {
        activityId: vocabularyActivityId,
        content: assertStepContent("vocabulary", {}),
        isPublished: true,
        kind: "vocabulary",
        position,
        wordId,
      },
    });

    if (translationActivityId) {
      await prisma.step.create({
        data: {
          activityId: translationActivityId,
          content: assertStepContent("translation", {}),
          isPublished: true,
          kind: "translation",
          position,
          wordId,
        },
      });
    }

    return { word: vocabWord.word, wordId: Number(wordId) };
  };
}

export async function saveVocabularyWordsStep(
  activities: LessonActivity[],
  words: VocabularyWord[],
  workflowRunId: string,
): Promise<{ savedWords: SavedWord[] }> {
  "use step";

  const vocabularyActivity = findActivityByKind(activities, "vocabulary");

  if (!vocabularyActivity || words.length === 0) {
    return { savedWords: [] };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "saveVocabularyWords" });

  const course = vocabularyActivity.lesson.chapter.course;

  if (!course.organization) {
    return { savedWords: [] };
  }

  const translationActivity = findActivityByKind(activities, "translation");

  if (translationActivity) {
    await setActivityAsRunningStep({
      activityId: translationActivity.id,
      workflowRunId,
    });
  }
  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = vocabularyActivity.language;
  const organizationId = course.organization.id;

  const existingCasing = await fetchExistingWordCasing({
    organizationId,
    targetLanguage,
    words: words.map((vocab) => vocab.word),
  });

  const saveOneWord = buildSaveOneWord({
    existingCasing,
    lessonId: vocabularyActivity.lessonId,
    organizationId,
    targetLanguage,
    translationActivityId: translationActivity?.id ?? null,
    userLanguage,
    vocabularyActivityId: vocabularyActivity.id,
  });

  const { data: savedWords, error } = await safeAsync(() =>
    Promise.all(words.map((vocabWord, index) => saveOneWord(vocabWord, index))),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "saveVocabularyWords" });

    await Promise.all([
      handleActivityFailureStep({ activityId: vocabularyActivity.id }),
      translationActivity
        ? handleActivityFailureStep({ activityId: translationActivity.id })
        : null,
    ]);

    return { savedWords: [] };
  }

  await stream.status({ status: "completed", step: "saveVocabularyWords" });
  return { savedWords };
}
