import {
  type StepStream,
  type WorkflowErrorReason,
  createStepStream,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import {
  type ActivityQuizSchema,
  type QuizQuestion,
  generateActivityQuiz,
} from "@zoonk/ai/tasks/activities/core/quiz";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
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
  stream: StepStream<ActivityStepName>,
  activityId: bigint | number,
  reason: WorkflowErrorReason,
): Promise<{ questions: [] }> {
  await stream.error({ reason, step: "generateQuizContent" });
  await handleActivityFailureStep({ activityId });
  return { questions: [] };
}

async function saveAndCompleteQuiz(
  stream: StepStream<ActivityStepName>,
  activityId: bigint | number,
  questions: QuizQuestion[],
): Promise<{ questions: QuizQuestion[] }> {
  const { error } = await saveQuizSteps(activityId, questions);

  if (error) {
    return handleQuizError(stream, activityId, "dbSaveFailed");
  }

  await stream.status({ status: "completed", step: "generateQuizContent" });
  return { questions };
}

export async function generateQuizContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
  quizIndex = 0,
): Promise<{ questions: QuizQuestion[] }> {
  "use step";

  const quizActivity = findActivitiesByKind(activities, "quiz")[quizIndex];

  if (!quizActivity) {
    return { questions: [] };
  }

  const resolved = await resolveActivityForGeneration(quizActivity);

  if (!resolved.shouldGenerate) {
    return { questions: [] };
  }

  const { activity } = resolved;

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return { questions: [] };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateQuizContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error }: SafeReturn<{ data: ActivityQuizSchema }> = await safeAsync(() =>
    generateActivityQuiz({
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
    return await handleQuizError(stream, activity.id, reason);
  }

  return await saveAndCompleteQuiz(stream, activity.id, result.data.questions);
}
