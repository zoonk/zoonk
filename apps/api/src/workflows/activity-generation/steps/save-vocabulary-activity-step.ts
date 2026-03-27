import { createStepStream } from "@/workflows/_shared/stream-status";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizePunctuation } from "@zoonk/utils/string";
import { fetchExistingWordCasing } from "./_utils/fetch-existing-word-casing";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Persists all vocabulary data in a single step:
 * - Upserts `Word` records (sets audioUrl, romanization)
 * - Upserts `WordPronunciation` records (pronunciation is language-specific
 *   but meaning-independent — "banco" sounds the same whether it means
 *   "bank" or "bench")
 * - Upserts `LessonWord` records with lesson-scoped translations (translations
 *   live on `LessonWord` because the same word can mean different things in
 *   different lessons)
 * - Creates `Step` records (kind: "vocabulary" + "translation")
 * - Marks vocabulary and translation activities as completed
 *
 * This is the single write point for the vocabulary workflow. All generate
 * steps produce data without DB writes; this step persists everything at once.
 */
export async function saveVocabularyActivityStep(params: {
  activities: LessonActivity[];
  alternatives: Record<string, string[]>;
  pronunciations: Record<string, string>;
  romanizations: Record<string, string>;
  wordAudioUrls: Record<string, string>;
  words: VocabularyWord[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  const {
    activities,
    alternatives,
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

  const existingCasing = await fetchExistingWordCasing({
    organizationId,
    targetLanguage,
    words: words.map((vocab) => vocab.word),
  });

  const { error } = await safeAsync(() =>
    Promise.all(
      words.map((vocabWord, position) =>
        saveOneVocabularyWord({
          alternatives,
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
    ),
  );

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
 * Upserts a single word with all its associated data: `Word` record,
 * `WordPronunciation` (if pronunciation exists), `LessonWord` with
 * lesson-scoped translation, and vocabulary/translation `Step` records.
 */
async function saveOneVocabularyWord(params: {
  alternatives: Record<string, string[]>;
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
    alternatives,
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
  const audioUrl = wordAudioUrls[vocabWord.word] ?? null;
  const romanization = romanizations[vocabWord.word] ?? null;
  const pronunciation = pronunciations[vocabWord.word] ?? null;
  const alternativeTranslations = alternatives[vocabWord.word] ?? [];

  const record = await prisma.word.upsert({
    create: {
      audioUrl,
      organizationId,
      romanization,
      targetLanguage,
      word: dbWord,
    },
    update: {
      ...(audioUrl ? { audioUrl } : {}),
      ...(romanization ? { romanization } : {}),
    },
    where: {
      orgWord: { organizationId, targetLanguage, word: dbWord },
    },
  });

  const wordId = record.id;

  if (pronunciation) {
    await prisma.wordPronunciation.upsert({
      create: { pronunciation, userLanguage, wordId },
      update: { pronunciation },
      where: { wordPronunciation: { userLanguage, wordId } },
    });
  }

  await prisma.lessonWord.upsert({
    create: {
      alternativeTranslations,
      lessonId,
      translation,
      userLanguage,
      wordId,
    },
    update: {
      ...(alternativeTranslations.length > 0 ? { alternativeTranslations } : {}),
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
 * instead of throwing. Real DB errors (connection, constraints) still throw
 * and propagate to the caller for proper failure handling.
 */
async function markActivityAsCompleted(activityId: number, workflowRunId: string): Promise<void> {
  await prisma.activity.updateMany({
    data: { generationRunId: workflowRunId, generationStatus: "completed" },
    where: { generationStatus: { not: "completed" }, id: activityId },
  });
}
