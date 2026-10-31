import { recordGoalResearchRun } from "@zoonk/core/library/sources/upload-request";

export async function recordResearchRunStep({
  goalId,
  runId,
}: {
  goalId: string;
  runId: string;
}): Promise<void> {
  "use step";

  await recordGoalResearchRun({ goalId, runId });
}
