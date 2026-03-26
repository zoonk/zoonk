import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type LessonKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonContext } from "./get-lesson-step";

export async function determineLessonKindStep(context: LessonContext): Promise<LessonKind> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "determineLessonKind" });

  const { data: result, error } = await safeAsync(() =>
    generateLessonKind({
      chapterTitle: context.chapter.title,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description,
      lessonTitle: context.title,
    }),
  );

  if (error) {
    await stream.error({ reason: "aiGenerationFailed", step: "determineLessonKind" });
    throw error;
  }

  await stream.status({ status: "completed", step: "determineLessonKind" });

  return result.data.kind;
}
