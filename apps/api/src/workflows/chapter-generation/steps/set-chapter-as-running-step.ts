import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function setChapterAsRunningStep(input: {
  chapterId: string;
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
    throw error;
  }

  await stream.status({ status: "completed", step: "setChapterAsRunning" });
}
