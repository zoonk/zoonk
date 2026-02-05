import {
  type ActivityExplanationQuizSchema,
  type QuizQuestion,
  generateActivityExplanationQuiz,
} from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

function parseQuizSteps(steps: { content: unknown; kind: string }[]): QuizQuestion[] {
  return steps.map((s) => {
    const content = s.content as Record<string, unknown>;
    return { format: s.kind, ...content } as QuizQuestion;
  });
}

export async function generateQuizContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
): Promise<{ questions: QuizQuestion[] }> {
  "use step";

  const activity = activities.find((a) => a.kind === "quiz");
  if (!activity) {
    return { questions: [] };
  }

  // Dependency check: quiz needs explanation
  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return { questions: [] };
  }

  // Resume: check if steps already exist in DB
  const { data: existingSteps } = await safeAsync(() =>
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { content: true, kind: true },
      where: { activityId: activity.id },
    }),
  );

  if (existingSteps && existingSteps.length > 0) {
    return { questions: parseQuizSteps(existingSteps) };
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

  if (error || !result) {
    await streamStatus({ status: "error", step: "generateQuizContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { questions: [] };
  }

  const questions = result.data.questions;

  if (questions.length === 0) {
    await streamStatus({ status: "error", step: "generateQuizContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { questions: [] };
  }

  // Save steps to DB immediately
  const { error: saveError } = await safeAsync(() =>
    prisma.step.createMany({
      data: questions.map((question, index) => {
        const { format, ...content } = question;
        return {
          activityId: activity.id,
          content,
          kind: format,
          position: index,
        };
      }),
    }),
  );

  if (saveError) {
    await handleActivityFailureStep({ activityId: activity.id });
    await streamStatus({ status: "error", step: "generateQuizContent" });
    return { questions: [] };
  }

  await streamStatus({ status: "completed", step: "generateQuizContent" });

  return { questions };
}
