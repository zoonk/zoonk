import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type QuizQuestion } from "@zoonk/ai/tasks/activities/core/quiz";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type QuizQuestionWithUrls } from "./generate-quiz-images-step";

/**
 * Builds step records from quiz questions.
 * For multipleChoice questions, adds `kind: "core"` to the content.
 * The `format` field from AI output maps to the step `kind` in the DB.
 */
function buildQuizStepRecords(
  activityId: string,
  questions: (QuizQuestion | QuizQuestionWithUrls)[],
) {
  return questions.map((question, index) => {
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
  });
}

/**
 * Persists all quiz step records and marks the activity as completed.
 * Receives the final questions with image URLs already injected
 * for selectImage-type questions.
 *
 * This is the single save point for a quiz entity.
 * Upstream steps (generateQuizContent, generateQuizImages) produce data only.
 */
export async function saveQuizActivityStep({
  activityId,
  questions,
  workflowRunId,
}: {
  activityId: string;
  questions: (QuizQuestion | QuizQuestionWithUrls)[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "saveQuizActivity" });

  const stepRecords = buildQuizStepRecords(activityId, questions);

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({ data: stepRecords }),
      prisma.activity.update({
        data: { generationRunId: workflowRunId, generationStatus: "completed" },
        where: { id: activityId },
      }),
    ]),
  );

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "saveQuizActivity" });
}
