import { generateLessonKind } from "@zoonk/ai/tasks/lessons/kind";
import { type LessonKind } from "@zoonk/db";
import { streamStatus } from "../stream-status";
import { type LessonContext } from "./get-lesson-step";

export async function determineLessonKindStep(context: LessonContext): Promise<LessonKind> {
  "use step";

  await streamStatus({ status: "started", step: "determineLessonKind" });

  try {
    const { data } = await generateLessonKind({
      chapterTitle: context.chapter.title,
      courseTitle: context.chapter.course.title,
      language: context.language,
      lessonDescription: context.description,
      lessonTitle: context.title,
    });

    await streamStatus({ status: "completed", step: "determineLessonKind" });

    return data.kind;
  } catch (error) {
    await streamStatus({ status: "error", step: "determineLessonKind" });
    throw error;
  }
}
