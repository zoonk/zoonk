import { generateActivityVocabulary } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export type VocabularyWord = {
  romanization: string;
  translation: string;
  word: string;
};

async function handleFailedActivity(activityId: number) {
  await prisma.step.deleteMany({ where: { activityId } });
}

export async function generateVocabularyContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<{ words: VocabularyWord[] }> {
  "use step";

  const activity = findActivityByKind(activities, "vocabulary");

  if (!activity) {
    return { words: [] };
  }

  if (activity.generationStatus === "completed" || activity.generationStatus === "running") {
    return { words: [] };
  }

  if (activity.generationStatus === "failed") {
    await handleFailedActivity(activity.id);
  }

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
