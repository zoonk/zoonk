import { createStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type LessonKind, prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { type LessonContext } from "./get-lesson-step";

/**
 * Translation lessons copy from the nearest completed vocabulary source so the
 * translated prompts stay tied to the exact word IDs already taught.
 */
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

/**
 * Prisma does not narrow nullable fields from `not: null` filters in the
 * generated TypeScript type. This helper turns only fully linked vocabulary
 * steps into the resource pair needed by derived translation steps.
 */
function getTranslationResource(step: {
  chapterWordId: string | null;
  wordId: string | null;
}): { chapterWordId: string; wordId: string } | null {
  if (!step.chapterWordId || !step.wordId) {
    return null;
  }

  return { chapterWordId: step.chapterWordId, wordId: step.wordId };
}

/**
 * Translation steps reuse the exact chapter-word resources from vocabulary
 * steps instead of regenerating words. That keeps translation practice aligned
 * with the generated translation and distractor bank.
 */
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
      chapterWordId: { not: null },
      kind: "vocabulary",
      lessonId: sourceLesson.id,
      wordId: { not: null },
    },
  });

  const wordSteps = sourceSteps.flatMap((step) => getTranslationResource(step) ?? []);

  if (wordSteps.length === 0) {
    throw new FatalError("Translation generation needs vocabulary words");
  }

  await prisma.step.deleteMany({ where: { lessonId: context.id } });

  await prisma.step.createMany({
    data: wordSteps.map((step, position) => ({
      chapterWordId: step.chapterWordId,
      content: assertStepContent("translation", {}),
      isPublished: true,
      kind: "translation" as const,
      lessonId: context.id,
      position,
      wordId: step.wordId,
    })),
  });

  await stream.status({ status: "completed", step: "saveTranslationLesson" });
}
