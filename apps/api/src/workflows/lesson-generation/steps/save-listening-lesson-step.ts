import { createStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { type LessonContext } from "./get-lesson-step";

export async function saveListeningLessonStep(context: LessonContext): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveListeningLesson" });

  const sourceLesson = await prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: {
      chapterId: context.chapterId,
      generationStatus: "completed",
      kind: "reading",
      position: { lt: context.position },
    },
  });

  if (!sourceLesson) {
    throw new FatalError("Listening generation needs a completed reading lesson");
  }

  const readingSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: {
      kind: "reading",
      lessonId: sourceLesson.id,
      sentenceId: { not: null },
    },
  });

  if (readingSteps.length === 0) {
    throw new FatalError("Listening generation needs reading sentences");
  }

  await prisma.step.deleteMany({ where: { lessonId: context.id } });
  await prisma.step.createMany({
    data: readingSteps.map((readingStep) => ({
      content: assertStepContent("listening", {}),
      isPublished: true,
      kind: "listening" as const,
      lessonId: context.id,
      position: readingStep.position,
      sentenceId: readingStep.sentenceId,
    })),
  });

  await stream.status({ status: "completed", step: "saveListeningLesson" });
}
