"use server";

import { openMistakeLesson } from "@zoonk/core/mistakes/open-mistake-lesson";

export async function resolveMistakeLessonAction(mistakeId: string): Promise<string | null> {
  const result = await openMistakeLesson(mistakeId);
  return result.status === "ready" ? result.lesson.id : null;
}
