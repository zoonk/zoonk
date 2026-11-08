import { recordGoalGeneration } from "@zoonk/core/goals/record-generation";

export async function recordGoalRunStep(
  input: Parameters<typeof recordGoalGeneration>[0],
): Promise<void> {
  "use step";

  await recordGoalGeneration(input);
}
