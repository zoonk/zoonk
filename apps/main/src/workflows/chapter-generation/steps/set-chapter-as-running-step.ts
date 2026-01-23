import { updateChapterGenerationStatus } from "@/data/chapters/update-chapter-generation-status";
import { streamStatus } from "../stream-status";

type SetRunningInput = {
  chapterId: number;
  workflowRunId: string;
};

export async function setChapterAsRunningStep(input: SetRunningInput): Promise<void> {
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
