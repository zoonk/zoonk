import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type QuizQuestionWithUrls } from "./generate-quiz-images-step";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsCompletedStep } from "./set-activity-as-completed-step";

export async function saveQuizActivityStep(
  activities: LessonActivity[],
  questions: QuizQuestionWithUrls[],
  workflowRunId: string,
): Promise<void> {
  "use step";

  const activity = activities.find((a) => a.kind === "quiz");

  if (!activity || questions.length === 0) {
    return;
  }

  if (activity.generationStatus === "completed") {
    return;
  }

  await streamStatus({ status: "started", step: "saveQuizActivity" });

  const stepsData = questions.map((question, index) => {
    const { format, ...content } = question;

    return {
      activityId: activity.id,
      content,
      kind: format,
      position: index,
    };
  });

  const { error } = await safeAsync(() => prisma.step.createMany({ data: stepsData }));

  if (error) {
    await streamStatus({ status: "error", step: "saveQuizActivity" });
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }

  await setActivityAsCompletedStep({ activityId: activity.id, workflowRunId });
  await streamStatus({ status: "completed", step: "saveQuizActivity" });
}
