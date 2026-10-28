import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./goal-specificity.prompt.md";

/** Claude Haiku 5.5 got all 16 goal-specificity cases at 1.7s p50; Luna got 14 (7 Oct 2026). */
const defaultModel = "anthropic/claude-haiku-5.5";
const defaultReasoning: Reasoning = "none";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.5-flash-lite"] as const;

const schema = z.object({
  generalGoal: z.string().nullable(),
  personalDetails: z.array(z.string()),
  privateCourse: z.boolean(),
});

export type GoalSpecificitySchema = z.infer<typeof schema>;

export type GoalSpecificityParams = {
  goal: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function toGoalInput({ goal }: { goal: string }) {
  return { GOAL: goal };
}

/** Only the yes-or-no part fits a classifier; the split itself needs generation. */
export const goalSpecificityClassifier = {
  question: {
    criteria: {
      false: "A general subject remains after removing personal details, so it can be shared.",
      true: "The subject itself is private to this learner, so nothing general remains to share.",
    },
    instructions: systemPrompt,
    type: "boolean",
  } as const,
  toInput: toGoalInput,
};

export async function classifyGoalSpecificity({
  analytics,
  goal,
  language,
  model = defaultModel,
  reasoning = defaultReasoning,
  useFallback = true,
}: GoalSpecificityParams) {
  const userPrompt = [
    `CONTENT_LANGUAGE: ${getPromptLanguageName({ language })}`,
    formatUntrustedInput(toGoalInput({ goal })),
  ].join("\n\n");

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "goal-specificity",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
