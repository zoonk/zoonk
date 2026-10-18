import { recordGoalResearchRun } from "@zoonk/core/library/sources/upload-request";

/** Remembers this run on its goal, so asking for research again follows it instead of paying again. */
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
