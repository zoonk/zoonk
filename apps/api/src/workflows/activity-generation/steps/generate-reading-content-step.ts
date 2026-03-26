import {
  type StepStream,
  type WorkflowErrorReason,
  createStepStream,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivitySentenceVariantInput,
  type ActivitySentenceVariantsSchema,
  generateActivitySentenceVariants,
} from "@zoonk/ai/tasks/activities/language/sentence-variants";
import {
  type ActivitySentencesSchema,
  generateActivitySentences,
} from "@zoonk/ai/tasks/activities/language/sentences";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import {
  type VocabularyVariantWord,
  mergeReadingSentenceVariants,
} from "./_utils/merge-reading-sentence-variants";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

type GeneratedReadingSentence = ActivitySentencesSchema["sentences"][number];
type AuditedReadingSentence = ActivitySentenceVariantsSchema["sentences"][number];

export type ReadingSentence = GeneratedReadingSentence & {
  alternativeSentences: string[];
  alternativeTranslations: string[];
};

/**
 * Fetches lesson words with their translation and alternativeTranslations
 * from the database. Used both as the source for sentence generation when
 * the current vocabulary run produced no words, and for sentence variant
 * derivation which needs the alternativeTranslations that the vocabulary
 * pronunciation-and-alternatives step already wrote to the DB.
 */
async function getLessonWords(params: {
  lessonId: number;
  organizationId: number | null;
  targetLanguage: string;
  userLanguage: string;
}): Promise<VocabularyVariantWord[]> {
  if (!params.organizationId) {
    return [];
  }

  const words = await prisma.lessonWord.findMany({
    orderBy: { id: "asc" },
    select: {
      word: {
        select: {
          translations: {
            select: {
              alternativeTranslations: true,
              translation: true,
            },
            where: { userLanguage: params.userLanguage },
          },
          word: true,
        },
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

  return words.flatMap((record) => {
    const translation = record.word.translations[0];

    if (!translation) {
      return [];
    }

    return [
      {
        alternativeTranslations: translation.alternativeTranslations,
        translation: translation.translation,
        word: record.word.word,
      },
    ];
  });
}

function hasValidSentences(sentences: ReadingSentence[]): boolean {
  return sentences.every(
    (sentence) => sentence.sentence.trim().length > 0 && sentence.translation.trim().length > 0,
  );
}

function createSentenceVariantInputs(
  sentences: GeneratedReadingSentence[],
): ActivitySentenceVariantInput[] {
  return sentences.map((sentence, index) => ({
    id: String(index),
    sentence: sentence.sentence,
    translation: sentence.translation,
  }));
}

function mergeSentenceVariants(
  sentences: GeneratedReadingSentence[],
  variants: AuditedReadingSentence[] | undefined,
): ReadingSentence[] {
  const variantsById = new Map(variants?.map((variant) => [variant.id, variant]));

  return sentences.map((sentence, index) => {
    const variant = variantsById.get(String(index));

    return {
      ...sentence,
      alternativeSentences: variant?.alternativeSentences ?? [],
      alternativeTranslations: variant?.alternativeTranslations ?? [],
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

export async function generateReadingContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
  currentRunWords: VocabularyWord[],
  concepts: string[] = [],
  neighboringConcepts: string[] = [],
): Promise<{ sentences: ReadingSentence[] }> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "reading");

  if (!resolved.shouldGenerate) {
    return { sentences: [] };
  }

  const { activity } = resolved;
  const course = activity.lesson.chapter.course;

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateSentences" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

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

  const { data: sentenceVariantsResult } =
    generatedSentences.length > 0
      ? await safeAsync(() =>
          generateActivitySentenceVariants({
            chapterTitle: activity.lesson.chapter.title,
            lessonDescription: activity.lesson.description ?? undefined,
            lessonTitle: activity.lesson.title,
            sentences: createSentenceVariantInputs(generatedSentences),
            targetLanguage: course.targetLanguage ?? course.title,
            userLanguage,
          }),
        )
      : { data: null };

  // Fetch words with alternativeTranslations from DB for variant derivation.
  // The in-memory sourceWords don't have alternativeTranslations since the
  // vocabulary AI task no longer generates them — they're produced by a
  // separate step which has already written them to the database by this point.
  const wordsWithAlternatives = await getLessonWords({
    lessonId: activity.lessonId,
    organizationId: course.organization?.id ?? null,
    targetLanguage,
    userLanguage,
  });

  const sentences = mergeReadingSentenceVariants(
    mergeSentenceVariants(generatedSentences, sentenceVariantsResult?.data.sentences),
    wordsWithAlternatives,
  );

  if (error || !result || sentences.length === 0 || !hasValidSentences(sentences)) {
    const reason = getAIResultErrorReason(error, result);
    return await handleReadingGenerationFailure(stream, activity.id, reason);
  }

  await stream.status({ status: "completed", step: "generateSentences" });
  return { sentences };
}
