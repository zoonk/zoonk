import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function removeNonLanguageLessonStep(input: { lessonId: number }): Promise<void> {
  "use step";

  await using stream = createStepStream<LessonStepName>();

  await stream.status({ status: "started", step: "removeNonLanguageLesson" });

  const { error } = await safeAsync(() => prisma.lesson.delete({ where: { id: input.lessonId } }));

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "removeNonLanguageLesson" });
    throw error;
  }

  await stream.status({ status: "completed", step: "removeNonLanguageLesson" });
}
