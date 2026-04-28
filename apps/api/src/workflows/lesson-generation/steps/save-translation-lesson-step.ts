import { createStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type LessonKind, prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { type LessonContext } from "./get-lesson-step";

async function getPreviousLessonByKind({
  context,
  kinds,
}: {
  context: LessonContext;
  kinds: LessonKind[];
}) {
  return prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: {
      chapterId: context.chapterId,
      generationStatus: "completed",
      kind: { in: kinds },
      position: { lt: context.position },
    },
  });
}

export async function saveTranslationLessonStep(context: LessonContext): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveTranslationLesson" });

  const sourceLesson = await getPreviousLessonByKind({
    context,
    kinds: ["alphabet", "vocabulary"],
  });

  if (!sourceLesson) {
    throw new FatalError("Translation generation needs a completed vocabulary lesson");
  }

  const sourceSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: {
      kind: "vocabulary",
      lessonId: sourceLesson.id,
      wordId: { not: null },
    },
  });
  const wordIds = sourceSteps.flatMap((step) => (step.wordId ? [step.wordId] : []));

  if (wordIds.length === 0) {
    throw new FatalError("Translation generation needs vocabulary words");
  }

  await prisma.step.deleteMany({ where: { lessonId: context.id } });
  await prisma.step.createMany({
    data: wordIds.map((wordId, position) => ({
      content: assertStepContent("translation", {}),
      isPublished: true,
      kind: "translation" as const,
      lessonId: context.id,
      position,
      wordId,
    })),
  });

  await stream.status({ status: "completed", step: "saveTranslationLesson" });
}
