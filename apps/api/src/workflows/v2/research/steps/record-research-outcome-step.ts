import { recordGoalResearchOutcome } from "@zoonk/core/library/sources/upload-request";
import { type ResearchResult } from "../research-result";

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
