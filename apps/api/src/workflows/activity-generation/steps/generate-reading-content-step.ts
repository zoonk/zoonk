import {
  type ActivitySentencesSchema,
  generateActivitySentences,
} from "@zoonk/ai/tasks/activities/language/sentences";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export type ReadingSentence = ActivitySentencesSchema["sentences"][number];

async function getFallbackLessonWords(params: {
  lessonId: number;
  organizationId: number;
  targetLanguage: string;
  userLanguage: string;
}): Promise<string[]> {
  const words = await prisma.lessonWord.findMany({
    orderBy: { id: "asc" },
    select: { word: { select: { word: true } } },
    where: {
      lessonId: params.lessonId,
      word: {
        organizationId: params.organizationId,
        targetLanguage: params.targetLanguage,
        userLanguage: params.userLanguage,
      },
    },
  });

  return words.map((record) => record.word.word);
}

function hasValidSentences(sentences: ReadingSentence[]): boolean {
  return sentences.every(
    (sentence) => sentence.sentence.trim().length > 0 && sentence.translation.trim().length > 0,
  );
}

export async function generateReadingContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
  currentRunWords: string[],
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

  let words = currentRunWords;

  if (words.length === 0) {
    const { data: fallbackWords, error: fallbackWordsError } = await safeAsync(() =>
      getFallbackLessonWords({
        lessonId: activity.lessonId,
        organizationId: course.organization.id,
        targetLanguage,
        userLanguage,
      }),
    );

    if (fallbackWordsError) {
      await streamStatus({ status: "error", step: "generateSentences" });
      await handleActivityFailureStep({ activityId: activity.id });
      return { sentences: [] };
    }

    words = fallbackWords ?? [];
  }

  if (words.length === 0) {
    await streamStatus({ status: "error", step: "generateSentences" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { sentences: [] };
  }

  const { data: result, error } = await safeAsync(() =>
    generateActivitySentences({
      lessonTitle: activity.lesson.title,
      targetLanguage: course.targetLanguage ?? course.title,
      userLanguage,
      words,
    }),
  );

  if (
    error ||
    !result ||
    result.data.sentences.length === 0 ||
    !hasValidSentences(result.data.sentences)
  ) {
    await streamStatus({ status: "error", step: "generateSentences" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { sentences: [] };
  }

  await streamStatus({ status: "completed", step: "generateSentences" });
  return { sentences: result.data.sentences };
}
