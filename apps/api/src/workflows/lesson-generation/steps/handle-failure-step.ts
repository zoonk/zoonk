import { streamError } from "@/workflows/_shared/stream-error";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function handleLessonFailureStep(input: { lessonId: number }): Promise<void> {
  "use step";

  await safeAsync(() =>
    prisma.lesson.update({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { id: input.lessonId },
    }),
  );

  await streamError({ reason: "aiGenerationFailed", step: "workflowError" });
}
