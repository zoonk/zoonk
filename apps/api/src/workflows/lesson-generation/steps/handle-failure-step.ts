import { createStepStream } from "@/workflows/_shared/stream-status";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function handleLessonFailureStep(input: { lessonId: string }): Promise<void> {
  "use step";

  await using stream = createStepStream();

  await safeAsync(() =>
    prisma.lesson.update({
      data: { generationStatus: "failed" },
      where: { id: input.lessonId },
    }),
  );

  await stream.error({ reason: "aiGenerationFailed", step: "workflowError" });
}
