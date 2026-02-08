import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";

export async function removeNonLanguageLessonStep(input: { lessonId: number }): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "removeNonLanguageLesson" });

  const { error } = await safeAsync(() => prisma.lesson.delete({ where: { id: input.lessonId } }));

  if (error) {
    await streamStatus({ status: "error", step: "removeNonLanguageLesson" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "removeNonLanguageLesson" });
}
