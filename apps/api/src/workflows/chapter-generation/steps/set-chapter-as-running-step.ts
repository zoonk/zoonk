import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";

/**
 * Chapter generation can be started by both course generation and the chapter
 * waiting page. Updating only claimable rows makes this step the ownership
 * boundary: one workflow gets to move the chapter into `running`, and any
 * duplicate workflow must stop before creating a second lesson plan.
 */
async function claimChapterGeneration(input: {
  chapterId: string;
  workflowRunId: string;
}): Promise<boolean> {
  const claim = await prisma.chapter.updateMany({
    data: { generationRunId: input.workflowRunId, generationStatus: "running" },
    where: { generationStatus: { in: ["pending", "failed"] }, id: input.chapterId },
  });

  if (claim.count > 0) {
    return true;
  }

  return false;
}

export async function setChapterAsRunningStep(input: {
  chapterId: string;
  workflowRunId: string;
}): Promise<boolean> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "setChapterAsRunning" });

  const isClaimed = await claimChapterGeneration(input);

  await stream.status({ status: "completed", step: "setChapterAsRunning" });

  return isClaimed;
}
