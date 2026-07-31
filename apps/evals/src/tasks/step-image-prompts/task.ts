import { type Task } from "@/lib/types";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { TEST_CASES } from "./test-cases";

type StepImagePromptsInput = Omit<
  Parameters<typeof generateStepImagePrompts>[0],
  "model" | "reasoning" | "useFallback"
>;

type StepImagePromptsOutput = Awaited<ReturnType<typeof generateStepImagePrompts>>["data"];

export const stepImagePromptsTask: Task<StepImagePromptsInput, StepImagePromptsOutput> = {
  description: "Generate one focused educational illustration prompt for every static lesson step",
  generate: generateStepImagePrompts,
  id: "step-image-prompts",
  name: "Step Image Prompts",
  testCases: TEST_CASES,
};
