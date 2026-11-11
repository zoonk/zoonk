import { pullLessonForFix } from "@zoonk/core/library/quality/pull-lesson-for-fix";

export async function pullLessonStep(lessonId: string): Promise<boolean> {
  "use step";

  return pullLessonForFix(lessonId);
}
