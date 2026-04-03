import { createStepStream } from "@/workflows/_shared/stream-status";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { safeAsync } from "@zoonk/utils/error";
import { deduplicateNormalizedTexts, normalizePunctuation } from "@zoonk/utils/string";
import { fetchExistingWordCasing } from "./_utils/fetch-existing-word-casing";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { upsertWordWithPronunciation } from "./_utils/upsert-word-with-pronunciation";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Persists canonical vocabulary words, their direct distractors, and the vocabulary plus
 * translation steps in one write phase.
 *
 * Canonical words become `LessonWord` rows with lesson-scoped translations and
 * distractors. Target-language distractor words are only enriched as `Word` plus
 * `WordPronunciation` records because they are render metadata, not taught lesson items.
 */
export async function saveVocabularyActivityStep(params: {
  activities: LessonActivity[];
  distractors: Record<string, string[]>;
  pronunciations: Record<string, string>;
  romanizations: Record<string, string>;
  wordAudioUrls: Record<string, string>;
  words: VocabularyWord[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  const {
    activities,
    distractors,
    pronunciations,
    romanizations,
    wordAudioUrls,
    words,
    workflowRunId,
  } = params;

  const vocabularyActivity = findActivityByKind(activities, "vocabulary");

  if (!vocabularyActivity || words.length === 0) {
    return;
  }

  const course = vocabularyActivity.lesson.chapter.course;

  if (!course.organization) {
    return;
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({
    entityId: vocabularyActivity.id,
    status: "started",
    step: "saveVocabularyActivity",
  });

  const translationActivity = findActivityByKind(activities, "translation");
  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = vocabularyActivity.language;
  const organizationId = course.organization.id;

  const allTargetWords = deduplicateNormalizedTexts([
    ...words.map((word) => word.word),
    ...words.flatMap((word) => distractors[word.word] ?? []),
  ]);

  const existingCasing = await fetchExistingWordCasing({
    organizationId,
    targetLanguage,
    words: allTargetWords,
  });

  const canonicalWordKeys = new Set(words.map((word) => word.word.toLowerCase()));

  const distractorWords = deduplicateNormalizedTexts(
    words.flatMap((word) => distractors[word.word] ?? []),
  ).filter((word) => !canonicalWordKeys.has(word.toLowerCase()));

  const { error } = await safeAsync(async () => {
    await Promise.all(
      words.map((vocabWord, position) =>
        saveOneVocabularyWord({
          distractors,
          existingCasing,
          lessonId: vocabularyActivity.lessonId,
          organizationId,
          position,
          pronunciations,
          romanizations,
          targetLanguage,
          translationActivityId: translationActivity?.id ?? null,
          userLanguage,
          vocabWord,
          vocabularyActivityId: vocabularyActivity.id,
          wordAudioUrls,
        }),
      ),
    );

    await Promise.all(
      distractorWords.map((word) => {
        const romanization = romanizations[word] ?? null;

        return upsertWordWithPronunciation({
          audioUrl: wordAudioUrls[word] ?? null,
          organizationId,
          pronunciation: pronunciations[word] ?? null,
          romanization,
          romanizationUpdate: romanization ? { romanization } : {},
          targetLanguage,
          userLanguage,
          word: existingCasing[word.toLowerCase()] ?? word,
        });
      }),
    );
  });

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "saveVocabularyActivity" });

    await Promise.all([
      handleActivityFailureStep({ activityId: vocabularyActivity.id }),
      translationActivity
        ? handleActivityFailureStep({ activityId: translationActivity.id })
        : null,
    ]);

    return;
  }

  await markActivityAsCompleted(vocabularyActivity.id, workflowRunId);

  if (translationActivity) {
    await markActivityAsCompleted(translationActivity.id, workflowRunId);
  }

  await stream.status({
    entityId: vocabularyActivity.id,
    status: "completed",
    step: "saveVocabularyActivity",
  });

  if (translationActivity) {
    await stream.status({
      entityId: translationActivity.id,
      status: "completed",
      step: "saveVocabularyActivity",
    });
  }
}

/**
 * Saves one canonical vocabulary word together with its lesson-scoped translation and
 * lesson-scoped distractor list. This is the only place where `LessonWord.distractors`
 * is written for translation activities.
 */
async function saveOneVocabularyWord(params: {
  distractors: Record<string, string[]>;
  existingCasing: Record<string, string>;
  lessonId: number;
  organizationId: number;
  position: number;
  pronunciations: Record<string, string>;
  romanizations: Record<string, string>;
  targetLanguage: string;
  translationActivityId: number | null;
  userLanguage: string;
  vocabWord: VocabularyWord;
  vocabularyActivityId: number;
  wordAudioUrls: Record<string, string>;
}): Promise<void> {
  const {
    distractors,
    existingCasing,
    lessonId,
    organizationId,
    position,
    pronunciations,
    romanizations,
    targetLanguage,
    translationActivityId,
    userLanguage,
    vocabWord,
    vocabularyActivityId,
    wordAudioUrls,
  } = params;

  const translation = normalizePunctuation(vocabWord.translation);
  const dbWord = existingCasing[vocabWord.word.toLowerCase()] ?? vocabWord.word;
  const romanization = romanizations[vocabWord.word] ?? null;
  const wordDistractors = sanitizeDistractors({
    distractors: distractors[vocabWord.word] ?? [],
    input: vocabWord.word,
    shape: "any",
  });

  const wordId = await upsertWordWithPronunciation({
    audioUrl: wordAudioUrls[vocabWord.word] ?? null,
    organizationId,
    pronunciation: pronunciations[vocabWord.word] ?? null,
    romanization,
    romanizationUpdate: romanization ? { romanization } : {},
    targetLanguage,
    userLanguage,
    word: dbWord,
  });

  await prisma.lessonWord.upsert({
    create: {
      distractors: wordDistractors,
      lessonId,
      translation,
      userLanguage,
      wordId,
    },
    update: {
      distractors: wordDistractors,
      translation,
    },
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
}

/**
 * Marks the activity as completed after all data has been saved.
 * Uses updateMany so "no matching row" (already completed) returns count=0
 * instead of throwing. Real DB errors still propagate to the caller.
 */
async function markActivityAsCompleted(activityId: number, workflowRunId: string): Promise<void> {
  await prisma.activity.updateMany({
    data: { generationRunId: workflowRunId, generationStatus: "completed" },
    where: { generationStatus: { not: "completed" }, id: activityId },
  });
}
