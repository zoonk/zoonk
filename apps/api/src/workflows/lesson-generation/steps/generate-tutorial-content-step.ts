import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonTutorial } from "@zoonk/ai/tasks/lessons/tutorial";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type StaticLessonStep } from "./_utils/generated-lesson-content";
import { type LessonContext } from "./get-lesson-step";

export async function generateTutorialContentStep(
  context: LessonContext,
): Promise<{ steps: StaticLessonStep[] }> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateTutorialContent" });

  const result = await generateLessonTutorial({
    chapterTitle: context.chapter.title,
    courseTitle: context.chapter.course.title,
    language: context.language,
    lessonDescription: context.description ?? "",
    lessonTitle: context.title ?? "",
  });

  await stream.status({ status: "completed", step: "generateTutorialContent" });

  return { steps: result.data.steps };
}
