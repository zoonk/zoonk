import { createStepStream } from "@/workflows/_shared/stream-status";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PracticeLessonContent } from "./_utils/generated-lesson-content";
import { replaceLessonSteps } from "./_utils/replace-lesson-steps";
import { savePracticeLessonContent } from "./_utils/save-core-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Replaces any partial practice questions with the generated situations and
 * images so retries do not leave mixed content.
 */
export async function savePracticeLessonStep({
  content,
  context,
  images,
}: {
  content: PracticeLessonContent;
  context: LessonContext;
  images: StepImage[];
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "savePracticeLesson" });

  await replaceLessonSteps({
    lessonId: context.id,
    saveSteps: (transaction) =>
      savePracticeLessonContent({ content, context, images, transaction }),
  });

  await stream.status({ status: "completed", step: "savePracticeLesson" });
}
