import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";

export async function setLessonAsRunningStep(input: {
  lessonId: number;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setLessonAsRunning" });

  const { error } = await safeAsync(() =>
    prisma.lesson.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "running",
      },
      select: { generationStatus: true, id: true },
      where: { id: input.lessonId },
    }),
  );

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "setLessonAsRunning" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "setLessonAsRunning" });
}
