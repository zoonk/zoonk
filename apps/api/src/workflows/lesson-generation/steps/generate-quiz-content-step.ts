import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonQuiz } from "@zoonk/ai/tasks/lessons/core/quiz";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { FatalError } from "workflow";
import { getPreviousExplanationSourceLesson } from "./_utils/explanation-source-steps";
import { type QuizLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Generates quiz questions from the nearest previous explanation metadata. A
 * fatal error still protects genuinely missing scope, but pending explanation
 * content no longer blocks quiz generation.
 */
export async function generateQuizContentStep(context: LessonContext): Promise<QuizLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateQuizContent" });

  const sourceLesson = await getPreviousExplanationSourceLesson(context);

  if (!sourceLesson) {
    throw new FatalError("Quiz generation needs explanation lesson metadata");
  }

  const result = await generateLessonQuiz({
    chapterTitle: context.chapter.title,
    courseTitle: context.chapter.course.title,
    language: context.language,
    lesson: sourceLesson,
  });

  await stream.status({ status: "completed", step: "generateQuizContent" });

  return { kind: "quiz", questions: result.data.questions };
}
