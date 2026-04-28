import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import { generateLessonQuiz } from "@zoonk/ai/tasks/lessons/core/quiz";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { getExplanationStepsSinceLastLessonKind } from "./_utils/explanation-source-steps";
import { type QuizLessonContent } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

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

  const { data: result, error }: SafeReturn<Awaited<ReturnType<typeof generateLessonQuiz>>> =
    await safeAsync(() =>
      generateLessonQuiz({
        chapterTitle: context.chapter.title,
        courseTitle: context.chapter.course.title,
        explanationSteps,
        language: context.language,
        lessonDescription: context.description,
        lessonTitle: context.title,
      }),
    );

  if (error || !result || result.data.questions.length === 0) {
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateQuizContent" });

  return { kind: "quiz", questions: result.data.questions };
}
