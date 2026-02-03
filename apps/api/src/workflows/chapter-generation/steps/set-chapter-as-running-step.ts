import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";

export async function setChapterAsRunningStep(input: {
  chapterId: number;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setChapterAsRunning" });

  const { error } = await safeAsync(() =>
    prisma.chapter.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "running",
      },
      select: { generationStatus: true, id: true },
      where: { id: input.chapterId },
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "setChapterAsRunning" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "setChapterAsRunning" });
}
