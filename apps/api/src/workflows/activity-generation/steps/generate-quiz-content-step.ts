import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivityExplanationQuizSchema,
  type QuizQuestion,
  generateActivityExplanationQuiz,
} from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

async function saveQuizSteps(
  activityId: bigint | number,
  questions: QuizQuestion[],
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
    prisma.step.createMany({
      data: questions.map((question, index) => {
        const { format, ...rawContent } = question;
        const content =
          format === "multipleChoice"
            ? assertStepContent(format, { ...rawContent, kind: "core" })
            : assertStepContent(format, rawContent);

        return {
          activityId,
          content,
          isPublished: true,
          kind: format,
          position: index,
        };
      }),
    }),
  );
}

async function handleQuizError(
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<{ questions: [] }> {
  await streamError({ reason, step: "generateQuizContent" });
  await handleActivityFailureStep({ activityId });
  return { questions: [] };
}

async function saveAndCompleteQuiz(
  activityId: bigint | number,
  questions: QuizQuestion[],
): Promise<{ questions: QuizQuestion[] }> {
  const { error } = await saveQuizSteps(activityId, questions);

  if (error) {
    return handleQuizError(activityId, "dbSaveFailed");
  }

  await streamStatus({ status: "completed", step: "generateQuizContent" });
  return { questions };
}

export async function generateQuizContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
): Promise<{ questions: QuizQuestion[] }> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "quiz");

  if (!resolved.shouldGenerate) {
    return { questions: [] };
  }

  const { activity } = resolved;

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return { questions: [] };
  }

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

  if (error || !result || result.data.questions.length === 0) {
    const reason = getAIResultErrorReason(error, result);
    return handleQuizError(activity.id, reason);
  }

  return saveAndCompleteQuiz(activity.id, result.data.questions);
}
