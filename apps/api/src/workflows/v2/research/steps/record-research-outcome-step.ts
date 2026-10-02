import { recordGoalResearchOutcome } from "@zoonk/core/library/sources/upload-request";
import { type ResearchResult } from "../research-result";

/**
 * Keeps what Plan and Today ask in step with the run's result: the upload research is waiting
 * for, or nothing once it found what it needed.
 */
export async function recordResearchOutcomeStep({
  goalId,
  result,
}: {
  goalId: string;
  result: ResearchResult;
}): Promise<void> {
  "use step";

  if (result.status === "missing") {
    return;
  }

  await recordGoalResearchOutcome({
    goalId,
    uploadReason: result.status === "needsUpload" ? result.reason : null,
  });
}
