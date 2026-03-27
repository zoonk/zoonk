import {
  type StepStream,
  createEntityStepStream,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivitySentenceDistractorUnsafeVariantInput,
  type ActivitySentenceDistractorUnsafeVariantsSchema,
  generateActivitySentenceDistractorUnsafeVariants,
} from "@zoonk/ai/tasks/activities/language/sentence-distractor-unsafe-variants";
import {
  type ActivitySentencesSchema,
  generateActivitySentences,
} from "@zoonk/ai/tasks/activities/language/sentences";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { type ActivityStepName, type WorkflowErrorReason } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import {
  type VocabularyDistractorUnsafeWord,
  mergeReadingSentenceDistractorUnsafeVariants,
} from "./_utils/merge-reading-sentence-distractor-unsafe-variants";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

type GeneratedReadingSentence = ActivitySentencesSchema["sentences"][number];
type AuditedReadingSentence = ActivitySentenceDistractorUnsafeVariantsSchema["sentences"][number];

export type ReadingSentence = GeneratedReadingSentence & {
  distractorUnsafeSentences: string[];
  distractorUnsafeTranslations: string[];
};

/**
 * Fetches lesson words with their `translation` and `distractorUnsafeTranslations`
 * from the database. Used both as the source for sentence generation when
 * the current vocabulary run produced no words, and for sentence distractor
 * derivation which needs the `distractorUnsafeTranslations` that the vocabulary
 * pronunciation-and-distractor-unsafes step already wrote to the DB.
 *
 * Translations live on `LessonWord` (not a separate table) because the same
 * word can mean different things in different lessons — e.g. "banco" means
 * "bank" in a finance lesson but "bench" in a furniture lesson.
 */
async function getLessonWords(params: {
  lessonId: number;
  organizationId: number | null;
  targetLanguage: string;
  userLanguage: string;
}): Promise<VocabularyDistractorUnsafeWord[]> {
  if (!params.organizationId) {
    return [];
  }

  const words = await prisma.lessonWord.findMany({
    orderBy: { id: "asc" },
    select: {
      distractorUnsafeTranslations: true,
      translation: true,
      word: {
        select: { word: true },
      },
    },
    where: {
      lessonId: params.lessonId,
      word: {
        organizationId: params.organizationId,
        targetLanguage: params.targetLanguage,
      },
    },
  });

  return words
    .filter((record) => record.translation)
    .map((record) => ({
      distractorUnsafeTranslations: record.distractorUnsafeTranslations,
      translation: record.translation,
      word: record.word.word,
    }));
}

function hasValidSentences(sentences: ReadingSentence[]): boolean {
  return sentences.every(
    (sentence) => sentence.sentence.trim().length > 0 && sentence.translation.trim().length > 0,
  );
}

function createSentenceDistractorUnsafeInputs(
  sentences: GeneratedReadingSentence[],
): ActivitySentenceDistractorUnsafeVariantInput[] {
  return sentences.map((sentence, index) => ({
    id: String(index),
    sentence: sentence.sentence,
    translation: sentence.translation,
  }));
}

function attachSentenceDistractorUnsafeData(
  sentences: GeneratedReadingSentence[],
  distractorUnsafeSentences: AuditedReadingSentence[] | undefined,
): ReadingSentence[] {
  const distractorUnsafeById = new Map(
    distractorUnsafeSentences?.map((sentence) => [sentence.id, sentence]),
  );

  return sentences.map((sentence, index) => {
    const distractorUnsafe = distractorUnsafeById.get(String(index));

    return {
      ...sentence,
      distractorUnsafeSentences: distractorUnsafe?.distractorUnsafeSentences ?? [],
      distractorUnsafeTranslations: distractorUnsafe?.distractorUnsafeTranslations ?? [],
    };
  });
}

async function resolveSourceWords(input: {
  currentRunWords: VocabularyWord[];
  lessonId: number;
  organizationId: number | null;
  targetLanguage: string;
  userLanguage: string;
}): Promise<{ error: Error; words: [] } | { error: null; words: VocabularyWord[] }> {
  if (input.currentRunWords.length > 0) {
    return { error: null, words: input.currentRunWords };
  }

  const { data: fallbackWords, error } = await safeAsync(() =>
    getLessonWords({
      lessonId: input.lessonId,
      organizationId: input.organizationId,
      targetLanguage: input.targetLanguage,
      userLanguage: input.userLanguage,
    }),
  );

  if (error) {
    return { error, words: [] };
  }

  return { error: null, words: fallbackWords ?? [] };
}

async function handleReadingGenerationFailure(
  stream: StepStream<ActivityStepName>,
  activityId: number,
  reason: WorkflowErrorReason,
): Promise<{ sentences: ReadingSentence[] }> {
  await stream.error({ reason, step: "generateSentences" });
  await handleActivityFailureStep({ activityId });
  return { sentences: [] };
}

/**
 * Generates reading sentences and their distractor-unsafe sentence metadata for a
 * single reading activity.
 * No status checks — the caller only passes activities that need generation.
 * Pure data producer: returns sentences without saving to the database.
 */
export async function generateReadingContentStep(
  activity: LessonActivity,
  workflowRunId: string,
  currentRunWords: VocabularyWord[],
  concepts: string[] = [],
  neighboringConcepts: string[] = [],
): Promise<{ sentences: ReadingSentence[] }> {
  "use step";

  const course = activity.lesson.chapter.course;

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateSentences" });

  const targetLanguage = course.targetLanguage ?? "";
  const userLanguage = activity.language;

  const sourceWords = await resolveSourceWords({
    currentRunWords,
    lessonId: activity.lessonId,
    organizationId: course.organization?.id ?? null,
    targetLanguage,
    userLanguage,
  });

  if (sourceWords.error || sourceWords.words.length === 0) {
    const reason = sourceWords.error ? "dbFetchFailed" : "noSourceData";
    return await handleReadingGenerationFailure(stream, activity.id, reason);
  }

  const { data: result, error } = await safeAsync(() =>
    generateActivitySentences({
      chapterTitle: activity.lesson.chapter.title,
      concepts,
      lessonDescription: activity.lesson.description ?? undefined,
      lessonTitle: activity.lesson.title,
      neighboringConcepts,
      targetLanguage: course.targetLanguage ?? course.title,
      userLanguage,
      words: sourceWords.words.map((word) => word.word),
    }),
  );

  const generatedSentences = result?.data.sentences ?? [];

  const { data: sentenceDistractorUnsafeResult } =
    generatedSentences.length > 0
      ? await safeAsync(() =>
          generateActivitySentenceDistractorUnsafeVariants({
            chapterTitle: activity.lesson.chapter.title,
            lessonDescription: activity.lesson.description ?? undefined,
            lessonTitle: activity.lesson.title,
            sentences: createSentenceDistractorUnsafeInputs(generatedSentences),
            targetLanguage: course.targetLanguage ?? course.title,
            userLanguage,
          }),
        )
      : { data: null };

  // Fetch words with distractorUnsafeTranslations from DB for sentence-level
  // distractor derivation.
  // The in-memory sourceWords don't have distractorUnsafeTranslations since the
  // vocabulary generation task no longer returns them directly. They're produced by a
  // separate step which has already written them to the database by this point.
  const wordsWithDistractorUnsafeTranslations = await getLessonWords({
    lessonId: activity.lessonId,
    organizationId: course.organization?.id ?? null,
    targetLanguage,
    userLanguage,
  });

  const sentences = mergeReadingSentenceDistractorUnsafeVariants(
    attachSentenceDistractorUnsafeData(
      generatedSentences,
      sentenceDistractorUnsafeResult?.data.sentences,
    ),
    wordsWithDistractorUnsafeTranslations,
  );

  if (error || !result || sentences.length === 0 || !hasValidSentences(sentences)) {
    const reason = getAIResultErrorReason(error, result);
    return await handleReadingGenerationFailure(stream, activity.id, reason);
  }

  await stream.status({ status: "completed", step: "generateSentences" });
  return { sentences };
}
