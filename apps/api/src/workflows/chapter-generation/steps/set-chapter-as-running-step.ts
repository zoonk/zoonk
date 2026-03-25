import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function setChapterAsRunningStep(input: {
  chapterId: number;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "setChapterAsRunning" });

  const { error } = await safeAsync(() =>
    prisma.chapter.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "running",
      },
      where: { id: input.chapterId },
    }),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "setChapterAsRunning" });
    throw error;
  }

  await stream.status({ status: "completed", step: "setChapterAsRunning" });
}
