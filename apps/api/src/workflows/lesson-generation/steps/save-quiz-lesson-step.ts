import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import {
  type QuizQuestionWithUrls,
  saveQuizLessonContent,
} from "./_utils/save-core-lesson-content";
import { type LessonContext } from "./get-lesson-step";

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

  await prisma.step.deleteMany({ where: { lessonId: context.id } });
  await saveQuizLessonContent({ context, questions });

  await stream.status({ status: "completed", step: "saveQuizLesson" });
}
