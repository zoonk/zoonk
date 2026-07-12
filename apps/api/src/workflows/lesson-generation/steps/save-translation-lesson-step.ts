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
 * Translation steps reuse the exact chapter-word resources just created by the
 * vocabulary workflow. The translation lesson row is a companion view over the
 * vocabulary content, so this step also marks that row completed.
 */
export async function saveTranslationLessonStep(context: LessonContext): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveTranslationLesson" });

  const translationLesson = await getGeneratedCompanionForSourceLesson(context);

  if (
    !translationLesson ||
    (translationLesson.generationStatus !== "pending" &&
      translationLesson.generationStatus !== "failed")
  ) {
    await stream.status({ status: "completed", step: "saveTranslationLesson" });
    return;
  }

  const sourceSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: {
      chapterWordId: { not: null },
      kind: "vocabulary",
      lessonId: context.id,
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
