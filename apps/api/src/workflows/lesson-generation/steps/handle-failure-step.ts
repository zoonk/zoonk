import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function handleLessonFailureStep(input: { lessonId: number }): Promise<void> {
  "use step";

  await safeAsync(() =>
    prisma.lesson.update({
      data: { generationStatus: "failed" },
      where: { id: input.lessonId },
    }),
  );
}
