import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { type LessonContext } from "./get-lesson-step";

export async function setLessonAsCompletedStep(input: {
  context: LessonContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setLessonAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.lesson.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "completed",
      },
      select: { generationStatus: true, id: true },
      where: { id: input.context.id },
    }),
  );

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "setLessonAsCompleted" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "setLessonAsCompleted" });
}
