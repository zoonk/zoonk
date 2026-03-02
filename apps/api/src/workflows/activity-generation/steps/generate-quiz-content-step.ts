import {
  type WorkflowErrorReason,
  getAIResultErrorReason,
} from "@/workflows/_shared/stream-status";
import {
  type ActivityQuizSchema,
  type QuizQuestion,
  generateActivityQuiz,
} from "@zoonk/ai/tasks/activities/core/quiz";
import { assertStepContent } from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { resolveActivitiesForGeneration } from "./_utils/content-step-helpers";
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
): Promise<{ activityId: bigint | number; questions: [] }> {
  await streamError({ reason, step: "generateQuizContent" });
  await handleActivityFailureStep({ activityId });
  return { activityId, questions: [] };
}

async function saveAndCompleteQuiz(
  activityId: bigint | number,
  questions: QuizQuestion[],
): Promise<{ activityId: bigint | number; questions: QuizQuestion[] }> {
  const { error } = await saveQuizSteps(activityId, questions);

  if (error) {
    return handleQuizError(activityId, "dbSaveFailed");
  }

  await streamStatus({ status: "completed", step: "generateQuizContent" });
  return { activityId, questions };
}

function getExplanationStepsByQuizActivity(params: {
  activities: LessonActivity[];
  explanationResults: { activityId: bigint | number; steps: ActivitySteps }[];
}): Map<string, ActivitySteps> {
  const explanationStepsByActivity = new Map(
    params.explanationResults.map((result) => [String(result.activityId), result.steps]),
  );

  const explanationStepsByQuiz = new Map<string, ActivitySteps>();
  const currentExplanationSteps: ActivitySteps = [];

  for (const activity of params.activities) {
    if (activity.kind === "explanation") {
      const explanationSteps = explanationStepsByActivity.get(String(activity.id)) ?? [];
      currentExplanationSteps.push(...explanationSteps);
    } else if (activity.kind === "quiz") {
      explanationStepsByQuiz.set(String(activity.id), [...currentExplanationSteps]);
      currentExplanationSteps.length = 0;
    }
  }

  return explanationStepsByQuiz;
}

export async function generateQuizContentStep(
  activities: LessonActivity[],
  explanationResults: { activityId: bigint | number; steps: ActivitySteps }[],
  workflowRunId: string,
): Promise<{ results: { activityId: bigint | number; questions: QuizQuestion[] }[] }> {
  "use step";

  const resolvedActivities = await resolveActivitiesForGeneration(activities, "quiz");

  if (resolvedActivities.length === 0) {
    return { results: [] };
  }

  const explanationStepsByQuiz = getExplanationStepsByQuizActivity({
    activities,
    explanationResults,
  });

  const results = await Promise.all(
    resolvedActivities.map(async (resolved) => {
      if (!resolved.shouldGenerate) {
        return { activityId: resolved.activity.id, questions: [] };
      }

      const activity = resolved.activity;
      const explanationSteps = explanationStepsByQuiz.get(String(activity.id)) ?? [];

      if (explanationSteps.length === 0) {
        return handleQuizError(activity.id, "noSourceData");
      }

      await streamStatus({ status: "started", step: "generateQuizContent" });
      await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

      const { data: result, error }: SafeReturn<{ data: ActivityQuizSchema }> = await safeAsync(
        () =>
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
        return handleQuizError(activity.id, reason);
      }

      return saveAndCompleteQuiz(activity.id, result.data.questions);
    }),
  );

  return { results };
}
