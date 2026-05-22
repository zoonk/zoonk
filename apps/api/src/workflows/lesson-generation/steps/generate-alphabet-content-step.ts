import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonAlphabet } from "@zoonk/ai/tasks/lessons/language/alphabet";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { FatalError } from "workflow";
import { buildAlphabetLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Generates the full alphabet lesson content with one focused AI task.
 *
 * Small alphabet lessons no longer need separate scope, intro, and symbol
 * authoring steps. Keeping one task avoids duplicated context and lets the model
 * decide whether an intro is useful before the symbol cards.
 */
export async function generateAlphabetContentStep(context: LessonContext) {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateAlphabetContent" });

  const targetLanguage = context.chapter.course.targetLanguage;

  if (!targetLanguage) {
    throw new FatalError("Alphabet content generation needs a target language");
  }

  const result = await generateLessonAlphabet({
    chapterTitle: context.chapter.title,
    lessonDescription: context.description ?? "",
    lessonTitle: context.title ?? "",
    targetLanguage,
    userLanguage: context.language,
  });

  await stream.status({ status: "completed", step: "generateAlphabetContent" });

  return buildAlphabetLessonContent(result.data);
}
