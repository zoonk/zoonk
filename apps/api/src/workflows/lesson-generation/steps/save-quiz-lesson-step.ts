import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { replaceLessonSteps } from "./_utils/replace-lesson-steps";
import {
  type QuizQuestionWithUrls,
  saveQuizLessonContent,
} from "./_utils/save-core-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Replaces any partial quiz steps with the generated question set in one save
 * operation so retries do not mix stale questions with fresh ones.
 */
export async function saveQuizLessonStep({
  context,
  questions,
}: {
  context: LessonContext;
  questions: QuizQuestionWithUrls[];
}): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveQuizLesson" });

  await replaceLessonSteps({
    lessonId: context.id,
    saveSteps: (transaction) => saveQuizLessonContent({ context, questions, transaction }),
  });

  await stream.status({ status: "completed", step: "saveQuizLesson" });
}
