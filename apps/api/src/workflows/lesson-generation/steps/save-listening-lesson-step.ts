import { createStepStream } from "@/workflows/_shared/stream-status";
import { getGeneratedCompanionForSourceLesson } from "@zoonk/core/lessons/generated-companions";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { replaceLessonSteps } from "./_utils/replace-lesson-steps";
import { type LessonContext } from "./get-lesson-step";

/**
 * Prisma keeps nullable field types even when the query filters them with
 * `not: null`. This helper returns the exact sentence resource only when the
 * reading step is fully linked.
 */
function getListeningResource(step: {
  chapterSentenceId: string | null;
  position: number;
  sentenceId: string | null;
}): { chapterSentenceId: string; position: number; sentenceId: string } | null {
  if (!step.chapterSentenceId || !step.sentenceId) {
    return null;
  }

  return {
    chapterSentenceId: step.chapterSentenceId,
    position: step.position,
    sentenceId: step.sentenceId,
  };
}

/**
 * Listening steps reuse chapter-sentence resources just created by the reading
 * workflow so audio, romanization, translations, and review metadata stay
 * attached to the same generated sentence rows.
 */
async function saveListeningLesson({
  listeningLessonId,
  sourceLessonId,
}: {
  listeningLessonId: string;
  sourceLessonId: string;
}): Promise<void> {
  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveListeningLesson" });

  const listeningLesson = await prisma.lesson.findUnique({ where: { id: listeningLessonId } });

  if (!listeningLesson || listeningLesson.generationStatus === "completed") {
    await stream.status({ status: "completed", step: "saveListeningLesson" });
    return;
  }

  const readingSteps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: {
      chapterSentenceId: { not: null },
      kind: "reading",
      lessonId: sourceLessonId,
      sentenceId: { not: null },
    },
  });

  const sentenceSteps = readingSteps.flatMap((step) => getListeningResource(step) ?? []);

  if (sentenceSteps.length === 0) {
    throw new FatalError("Listening save needs reading sentences");
  }

  await replaceLessonSteps({
    lessonId: listeningLesson.id,
    saveSteps: async (transaction) => {
      await transaction.step.createMany({
        data: sentenceSteps.map((readingStep) => ({
          chapterSentenceId: readingStep.chapterSentenceId,
          content: assertStepContent("listening", {}),
          isPublished: true,
          kind: "listening" as const,
          lessonId: listeningLesson.id,
          position: readingStep.position,
          sentenceId: readingStep.sentenceId,
        })),
      });

      await transaction.lesson.update({
        data: { generationRunId: null, generationStatus: "completed" },
        where: { id: listeningLesson.id },
      });
    },
  });

  await stream.status({ status: "completed", step: "saveListeningLesson" });
}

/**
 * Repairs the pending companion of an already-completed reading lesson. The
 * source is immutable, so this path completes the repaired companion immediately.
 */
export async function saveListeningLessonStep(context: LessonContext): Promise<void> {
  "use step";

  const listeningLesson = await getGeneratedCompanionForSourceLesson({
    chapterId: context.chapterId,
    lessonId: context.id,
  });

  if (!listeningLesson) {
    return;
  }

  await saveListeningLesson({ listeningLessonId: listeningLesson.id, sourceLessonId: context.id });
}
