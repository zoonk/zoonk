import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonContext } from "./get-lesson-step";

export async function setLessonAsCompletedStep(input: {
  context: LessonContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "setLessonAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.lesson.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "completed",
      },
      where: { id: input.context.id },
    }),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "setLessonAsCompleted" });
    throw error;
  }

  await stream.status({ status: "completed", step: "setLessonAsCompleted" });
}
