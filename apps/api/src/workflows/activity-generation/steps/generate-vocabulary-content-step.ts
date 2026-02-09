import { generateActivityVocabulary } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export type VocabularyWord = {
  romanization: string;
  translation: string;
  word: string;
};

export async function generateVocabularyContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<{ words: VocabularyWord[] }> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "vocabulary");

  if (!resolved.shouldGenerate) {
    return { words: [] };
  }

  const { activity } = resolved;

  await streamStatus({ status: "started", step: "generateVocabularyContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error } = await safeAsync(() =>
    generateActivityVocabulary({
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
    }),
  );

  if (error || !result) {
    await streamStatus({ status: "error", step: "generateVocabularyContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { words: [] };
  }

  if (result.data.words.length === 0) {
    await streamStatus({ status: "error", step: "generateVocabularyContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { words: [] };
  }

  await streamStatus({ status: "completed", step: "generateVocabularyContent" });
  return { words: result.data.words };
}
