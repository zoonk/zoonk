import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type LessonContext } from "./get-lesson-step";

export async function setLessonAsCompletedStep(input: {
  context: LessonContext;
  description?: string;
  imageUrl?: string | null;
  title?: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "setLessonAsCompleted" });

  await prisma.lesson.update({
    data: {
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      ...(input.title === undefined ? {} : { title: input.title }),
      generationStatus: "completed",
    },
    where: { id: input.context.id },
  });

  await stream.status({ status: "completed", step: "setLessonAsCompleted" });
}
