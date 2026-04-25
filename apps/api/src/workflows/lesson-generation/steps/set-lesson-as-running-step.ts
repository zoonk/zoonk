import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function setLessonAsRunningStep(input: {
  lessonId: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "setLessonAsRunning" });

  const { error } = await safeAsync(() =>
    prisma.lesson.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "running",
      },
      where: { id: input.lessonId },
    }),
  );

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "setLessonAsRunning" });
}
