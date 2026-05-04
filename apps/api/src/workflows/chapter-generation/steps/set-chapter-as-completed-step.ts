import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type ChapterContext } from "./get-chapter-step";

export async function setChapterAsCompletedStep(input: {
  context: ChapterContext;
  imageUrl?: string | null;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "setChapterAsCompleted" });

  await prisma.chapter.update({
    data: {
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      generationRunId: input.workflowRunId,
      generationStatus: "completed",
    },
    where: { id: input.context.id },
  });

  await stream.status({ status: "completed", step: "setChapterAsCompleted" });
}
