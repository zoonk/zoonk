import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./goal-specificity.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite", "anthropic/claude-haiku-4.5"] as const;

const schema = z.object({
  generalGoal: z.string().nullable(),
  personalDetails: z.array(z.string()),
  privateCourse: z.boolean(),
});

export type GoalSpecificitySchema = z.infer<typeof schema>;

export type GoalSpecificityParams = {
  goal: string;
  /** The content language, as a language code. */
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function toGoalInput({ goal }: { goal: string }) {
  return { GOAL: goal };
}

/**
 * The private-course decision as an evaluation question, so evals can compare
 * Jev with the generation task on the same labels before any flow relies on it.
 * The split itself needs generation; only the yes-or-no part fits a classifier.
 */
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

/**
 * Splits a goal into the part the shared Library can serve and the details
 * that stay with the learner, and decides when the whole request needs a
 * private course that is never indexed or reused.
 */
export async function classifyGoalSpecificity({
  analytics,
  goal,
  language,
  model = defaultModel,
  reasoning,
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
