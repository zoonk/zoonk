import { recordGoalGeneration } from "@zoonk/core/goals/record-generation";

/** Saves this run on its goal, so onboarding and the explanation's wait can follow it live. */
export async function recordGoalRunStep(input: {
  generationId: string;
  goalId: string;
}): Promise<void> {
  "use step";

  await recordGoalGeneration(input);
}
