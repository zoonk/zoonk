import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type VocabularyWord,
  generateActivityVocabulary,
} from "@zoonk/ai/tasks/activities/language/vocabulary";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates vocabulary words via AI for a single vocabulary activity.
 * No status checks — the caller only passes activities that need generation.
 * Pure data producer: returns words without saving to the database.
 */
export async function generateVocabularyContentStep(
  activity: LessonActivity,
  workflowRunId: string,
  concepts: string[] = [],
  neighboringConcepts: string[] = [],
): Promise<{ words: VocabularyWord[] }> {
  "use step";

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateVocabularyContent" });

  const { data: result, error } = await safeAsync(() =>
    generateActivityVocabulary({
      chapterTitle: activity.lesson.chapter.title,
      concepts,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
      neighboringConcepts,
      targetLanguage:
        activity.lesson.chapter.course.targetLanguage ?? activity.lesson.chapter.course.title,
      userLanguage: activity.language,
    }),
  );

  if (error || !result) {
    const reason = error ? "aiGenerationFailed" : "aiEmptyResult";
    await stream.error({ reason, step: "generateVocabularyContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { words: [] };
  }

  if (result.data.words.length === 0) {
    await stream.error({ reason: "contentValidationFailed", step: "generateVocabularyContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { words: [] };
  }

  await stream.status({ status: "completed", step: "generateVocabularyContent" });
  return { words: result.data.words };
}
