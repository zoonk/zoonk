import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivitySentencesSchema,
  generateActivitySentences,
} from "@zoonk/ai/tasks/activities/language/sentences";
import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { enrichReadingSentenceVariants } from "./_utils/enrich-reading-sentence-variants";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export type ReadingSentence = ActivitySentencesSchema["sentences"][number];

async function getFallbackLessonWords(params: {
  lessonId: number;
  organizationId: number | null;
  targetLanguage: string;
  userLanguage: string;
}): Promise<VocabularyWord[]> {
  if (!params.organizationId) {
    return [];
  }

  const words = await prisma.lessonWord.findMany({
    orderBy: { id: "asc" },
    select: {
      word: {
        select: {
          alternativeTranslations: true,
          romanization: true,
          translation: true,
          word: true,
        },
      },
    },
    where: {
      lessonId: params.lessonId,
      word: {
        organizationId: params.organizationId,
        targetLanguage: params.targetLanguage,
        userLanguage: params.userLanguage,
      },
    },
  });

  return words.map((record) => record.word);
}

function hasValidSentences(sentences: ReadingSentence[]): boolean {
  return sentences.every(
    (sentence) => sentence.sentence.trim().length > 0 && sentence.translation.trim().length > 0,
  );
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
    getFallbackLessonWords({
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
  activityId: number,
  reason: WorkflowErrorReason,
): Promise<{ sentences: ReadingSentence[] }> {
  await streamError({ reason, step: "generateSentences" });
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

  await streamStatus({ status: "started", step: "generateSentences" });
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
    return handleReadingGenerationFailure(activity.id, reason);
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

  const sentences = result
    ? enrichReadingSentenceVariants(result.data.sentences, sourceWords.words)
    : [];

  if (error || !result || sentences.length === 0 || !hasValidSentences(sentences)) {
    const reason = getAIResultErrorReason(error, result);
    return handleReadingGenerationFailure(activity.id, reason);
  }

  await streamStatus({ status: "completed", step: "generateSentences" });
  return { sentences };
}
