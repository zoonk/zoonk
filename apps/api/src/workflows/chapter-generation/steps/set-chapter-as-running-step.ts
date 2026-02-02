import { updateChapterGenerationStatus } from "@/data/chapters/update-chapter-generation-status";
import { streamStatus } from "../stream-status";

export async function setChapterAsRunningStep(input: {
  chapterId: number;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setChapterAsRunning" });

  const { error } = await updateChapterGenerationStatus({
    chapterId: input.chapterId,
    generationRunId: input.workflowRunId,
    generationStatus: "running",
  });

  if (error) {
    await streamStatus({ status: "error", step: "setChapterAsRunning" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "setChapterAsRunning" });
}
