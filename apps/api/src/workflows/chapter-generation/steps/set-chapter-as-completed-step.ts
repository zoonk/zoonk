import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type ChapterContext } from "./get-chapter-step";

export async function setChapterAsCompletedStep(input: {
  context: ChapterContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "setChapterAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.chapter.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "completed",
      },
      where: { id: input.context.id },
    }),
  );

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "setChapterAsCompleted" });
    throw error;
  }

  await stream.status({ status: "completed", step: "setChapterAsCompleted" });
}
