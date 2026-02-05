import {
  type ActivityExplanationQuizSchema,
  type QuizQuestion,
  generateActivityExplanationQuiz,
} from "@zoonk/ai/tasks/activities/core/explanation-quiz";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { toRecord } from "@zoonk/utils/json";
import { streamStatus } from "../stream-status";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

function parseQuizSteps(steps: { content: unknown; kind: string }[]): QuizQuestion[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- reconstructing QuizQuestion union from DB; kind discriminates the shape
  return steps.map((step) => ({ format: step.kind, ...toRecord(step.content) }) as QuizQuestion);
}

async function getExistingQuizSteps(activityId: bigint): Promise<QuizQuestion[] | null> {
  const { data: existingSteps } = await safeAsync(() =>
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { content: true, kind: true },
      where: { activityId },
    }),
  );

  if (existingSteps && existingSteps.length > 0) {
    return parseQuizSteps(existingSteps);
  }

  return null;
}

async function saveQuizSteps(
  activityId: bigint,
  questions: QuizQuestion[],
): Promise<{ error: Error | null }> {
  return safeAsync(() =>
    prisma.step.createMany({
      data: questions.map((question, index) => {
        const { format, ...content } = question;
        return {
          activityId,
          content,
          kind: format,
          position: index,
        };
      }),
    }),
  );
}

async function handleQuizError(activityId: bigint): Promise<{ questions: [] }> {
  await streamStatus({ status: "error", step: "generateQuizContent" });
  await handleActivityFailureStep({ activityId });
  return { questions: [] };
}

async function saveAndCompleteQuiz(
  activityId: bigint,
  questions: QuizQuestion[],
): Promise<{ questions: QuizQuestion[] }> {
  const { error } = await saveQuizSteps(activityId, questions);

  if (error) {
    return handleQuizError(activityId);
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

  const activity = activities.find((act) => act.kind === "quiz");
  if (!activity) {
    return { questions: [] };
  }

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return { questions: [] };
  }

  const existing = await getExistingQuizSteps(activity.id);
  if (existing) {
    return { questions: existing };
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
    return handleQuizError(activity.id);
  }

  return saveAndCompleteQuiz(activity.id, result.data.questions);
}
