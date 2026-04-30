import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonQuiz } from "@zoonk/ai/tasks/lessons/core/quiz";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { FatalError } from "workflow";
import { getExplanationStepsSinceLastLessonKind } from "./_utils/explanation-source-steps";
import { type QuizLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

/**
 * Generates quiz questions from the explanation steps that have not already
 * fed an earlier quiz lesson. The fatal prerequisite check keeps the workflow
 * from creating disconnected quizzes when source explanations are missing.
 */
export async function generateQuizContentStep(context: LessonContext): Promise<QuizLessonContent> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateQuizContent" });

  const explanationSteps = await getExplanationStepsSinceLastLessonKind({
    context,
    kind: "quiz",
  });

  if (explanationSteps.length === 0) {
    throw new FatalError("Quiz generation needs completed explanation lessons");
  }

  const result = await generateLessonQuiz({
    chapterTitle: context.chapter.title,
    courseTitle: context.chapter.course.title,
    explanationSteps,
    language: context.language,
    lessonDescription: context.description ?? "",
    lessonTitle: context.title ?? "",
  });

  await stream.status({ status: "completed", step: "generateQuizContent" });

  return { kind: "quiz", questions: result.data.questions };
}
