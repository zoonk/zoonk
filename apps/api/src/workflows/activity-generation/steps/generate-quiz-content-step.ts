import {
  type ActivityExplanationQuizSchema,
  type QuizQuestion,
  generateActivityExplanationQuiz,
} from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function generateQuizContentStep(
  activity: LessonActivity,
  explanationSteps: ActivitySteps,
  workflowRunId: string,
): Promise<{ questions: QuizQuestion[] }> {
  "use step";

  await streamStatus({ status: "started", step: "generateQuizContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityExplanationQuizSchema }> =
    await safeAsync(() =>
      generateActivityExplanationQuiz({
        chapterTitle: activity.lesson.chapter.title,
        courseTitle: activity.lesson.chapter.course.title,
        explanationSteps,
        language: activity.language,
        lessonDescription: activity.lesson.description ?? "",
        lessonTitle: activity.lesson.title,
      }),
    );

  if (error) {
    await streamStatus({ status: "error", step: "generateQuizContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateQuizContent" });

  return { questions: result.data.questions };
}
