import {
  type StepStream,
  createEntityStepStream,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivitySentencesSchema,
  generateActivitySentences,
} from "@zoonk/ai/tasks/activities/language/sentences";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { type ActivityStepName, type WorkflowErrorReason } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

type SourceWord = Pick<VocabularyWord, "word">;

export type ReadingSentence = ActivitySentencesSchema["sentences"][number];

/**
 * Reading sentence generation only needs the target-language source words.
 * Reusing existing lesson vocabulary when the current workflow run has none keeps the
 * workflow resumable without reintroducing any distractor-specific coupling.
 */
async function getLessonWords(params: {
  lessonId: number;
  organizationId: number | null;
  targetLanguage: string;
}): Promise<SourceWord[]> {
  if (!params.organizationId) {
    return [];
  }

  const words = await prisma.lessonWord.findMany({
    orderBy: { id: "asc" },
    select: {
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

  return words.map((record) => ({ word: record.word.word }));
}

/**
 * Generated reading sentences must contain both the target-language sentence and the
 * learner-language translation. This small validator keeps the main workflow readable.
 */
function hasValidSentences(sentences: ReadingSentence[]): boolean {
  return sentences.every(
    (sentence) => sentence.sentence.trim().length > 0 && sentence.translation.trim().length > 0,
  );
}

/**
 * Reading generation can resume from the current vocabulary run or from vocabulary that
 * already exists in the lesson. Keeping that fallback here avoids branching in the main
 * workflow function.
 */
async function resolveSourceWords(input: {
  currentRunWords: SourceWord[];
  lessonId: number;
  organizationId: number | null;
  targetLanguage: string;
}): Promise<{ error: Error; words: [] } | { error: null; words: SourceWord[] }> {
  if (input.currentRunWords.length > 0) {
    return { error: null, words: input.currentRunWords };
  }

  const { data: fallbackWords, error } = await safeAsync(() =>
    getLessonWords({
      lessonId: input.lessonId,
      organizationId: input.organizationId,
      targetLanguage: input.targetLanguage,
    }),
  );

  if (error) {
    return { error, words: [] };
  }

  return { error: null, words: fallbackWords ?? [] };
}

/**
 * Reading generation failures need to mark the activity as failed and return an empty
 * payload so the workflow can stop without leaving partially-generated sentences in play.
 */
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
 * Generates the canonical reading sentences for a lesson.
 *
 * This step intentionally produces only the real sentence pairs. Distractors are
 * generated in a separate direct-generation step and are no longer derived from
 * sentence variants or vocabulary-level blocker metadata.
 */
export async function generateReadingContentStep(
  activity: LessonActivity,
  workflowRunId: string,
  currentRunWords: SourceWord[],
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

  const sentences = result?.data.sentences ?? [];

  if (error || !result || sentences.length === 0 || !hasValidSentences(sentences)) {
    const reason = getAIResultErrorReason(error, result);
    return await handleReadingGenerationFailure(stream, activity.id, reason);
  }

  await stream.status({ status: "completed", step: "generateSentences" });
  return { sentences };
}
