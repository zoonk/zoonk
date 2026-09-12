import { getLessonRevisionContext } from "@/workflows/_shared/course-generation-context";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { withCurrentCourseRevision } from "@zoonk/core/workflows/internal/course-curriculum";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type LessonContext } from "./get-lesson-step";

/**
 * Completes ordinary generated lessons after their independent save steps have
 * finished. Split language lessons complete inside their atomic persistence
 * transaction and therefore never call this step.
 */
export async function setLessonAsCompletedStep(input: {
  context: LessonContext;
  description?: string;
  imageUrl?: string | null;
  title?: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "setLessonAsCompleted" });

  const saved = await withCurrentCourseRevision({
    context: getLessonRevisionContext(input.context),
    operation: (transaction) =>
      transaction.lesson.updateMany({
        data: {
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
          ...(input.title === undefined ? {} : { title: input.title }),
          generationStatus: "completed",
        },
        where: { id: input.context.id },
      }),
  });

  if (saved.status === "superseded" || saved.value.count === 0) {
    return;
  }

  await stream.status({ status: "completed", step: "setLessonAsCompleted" });
}
