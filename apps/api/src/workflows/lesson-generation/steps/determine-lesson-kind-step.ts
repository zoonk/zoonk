import { generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { type LessonKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { type LessonContext } from "./get-lesson-step";

export async function determineLessonKindStep(context: LessonContext): Promise<LessonKind> {
  "use step";

  await streamStatus({ status: "started", step: "determineLessonKind" });

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
    await streamError({ reason: "aiGenerationFailed", step: "determineLessonKind" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "determineLessonKind" });

  return result.data.kind;
}
