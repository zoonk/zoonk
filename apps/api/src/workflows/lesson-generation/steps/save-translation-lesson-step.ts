import { createStepStream } from "@/workflows/_shared/stream-status";
import { getGeneratedCompanionForSourceLesson } from "@zoonk/core/lessons/generated-companions";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { replaceLessonSteps } from "./_utils/replace-lesson-steps";
import { type LessonContext } from "./get-lesson-step";

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
 * Translation repair reuses the exact chapter-word resources already saved by
 * its completed vocabulary source, then completes the companion row.
 */
async function saveTranslationLesson({
  sourceLessonId,
  translationLessonId,
}: {
  sourceLessonId: string;
  translationLessonId: string;
}): Promise<void> {
  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveTranslationLesson" });

  const translationLesson = await prisma.lesson.findUnique({ where: { id: translationLessonId } });

  if (!translationLesson || translationLesson.generationStatus === "completed") {
    await stream.status({ status: "completed", step: "saveTranslationLesson" });
    return;
  }

  const sourceSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: {
      chapterWordId: { not: null },
      kind: "vocabulary",
      lessonId: sourceLessonId,
      wordId: { not: null },
    },
  });

  const wordSteps = sourceSteps.flatMap((step) => getTranslationResource(step) ?? []);

  if (wordSteps.length === 0) {
    throw new FatalError("Translation save needs vocabulary words");
  }

  await replaceLessonSteps({
    lessonId: translationLesson.id,
    saveSteps: async (transaction) => {
      await transaction.step.createMany({
        data: wordSteps.map((step, position) => ({
          chapterWordId: step.chapterWordId,
          content: assertStepContent("translation", {}),
          isPublished: true,
          kind: "translation" as const,
          lessonId: translationLesson.id,
          position,
          wordId: step.wordId,
        })),
      });

      await transaction.lesson.update({
        data: { generationRunId: null, generationStatus: "completed" },
        where: { id: translationLesson.id },
      });
    },
  });

  await stream.status({ status: "completed", step: "saveTranslationLesson" });
}

/**
 * Repairs the pending companion of an already-completed vocabulary lesson. This
 * legacy repair path resolves the current pair and completes only that companion
 * because the source workflow has already finished.
 */
export async function saveTranslationLessonStep(context: LessonContext): Promise<void> {
  "use step";

  const translationLesson = await getGeneratedCompanionForSourceLesson({
    chapterId: context.chapterId,
    lessonId: context.id,
  });

  if (!translationLesson) {
    return;
  }

  await saveTranslationLesson({
    sourceLessonId: context.id,
    translationLessonId: translationLesson.id,
  });
}
