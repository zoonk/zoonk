import { recordGoalGeneration } from "@zoonk/core/goals/record-generation";

export async function recordGoalRunStep(input: {
  generationId: string;
  goalId: string;
}): Promise<void> {
  "use step";

  await recordGoalGeneration(input);
}
