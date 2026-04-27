import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonContext } from "./get-lesson-step";

export async function setLessonAsCompletedStep(input: { context: LessonContext }): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "setLessonAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.lesson.update({
      data: {
        generationStatus: "completed",
      },
      where: { id: input.context.id },
    }),
  );

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "setLessonAsCompleted" });
}
