import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type LessonContext } from "./get-lesson-step";

export async function setLessonAsCompletedStep(input: {
  context: LessonContext;
  imageUrl?: string | null;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "setLessonAsCompleted" });

  await prisma.lesson.update({
    data: {
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      generationStatus: "completed",
    },
    where: { id: input.context.id },
  });

  await stream.status({ status: "completed", step: "setLessonAsCompleted" });
}
