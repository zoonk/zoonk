import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonQuiz } from "@zoonk/ai/tasks/lessons/core/quiz";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { FatalError } from "workflow";
import { getSourceLessonsSinceLastLessonKind } from "./_utils/explanation-source-steps";
import { type QuizLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Generates quiz questions from explanation lesson metadata that has not
 * already fed an earlier quiz. A fatal error still protects genuinely missing
 * scope, but pending explanation content no longer blocks quiz generation.
 */
export async function generateQuizContentStep(context: LessonContext): Promise<QuizLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateQuizContent" });

  const sourceLessons = await getSourceLessonsSinceLastLessonKind({ context, kind: "quiz" });

  if (sourceLessons.length === 0) {
    throw new FatalError("Quiz generation needs explanation lesson metadata");
  }

  const result = await generateLessonQuiz({
    chapterTitle: context.chapter.title,
    courseTitle: context.chapter.course.title,
    language: context.language,
    sourceLessons,
  });

  await stream.status({ status: "completed", step: "generateQuizContent" });

  return { kind: "quiz", questions: result.data.questions };
}
