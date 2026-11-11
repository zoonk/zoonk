import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./goal-specificity.prompt.md";

/**
 * Onboarding waits on this call. On 21 cases (11 Nov 2026), Muse Ember without reasoning passed
 * every case at 0.91 s p50 for $0.13/1k; Haiku 5.5 scored 9.90 (it invented an occupation) at
 * 1.63 s for $0.08/1k, and a blind GPT-6.1 Sol read found 2 Ember wins and 19 ties. Ember's
 * provider refuses some hostile course requests, but Ember answered all 8 legitimate goals a filter
 * might misread, such as pentesting or lethal doses; Haiku and Luna (9.71) fall back. Jev decided
 * all 21 at half Haiku's cost but can't write the shareable goal and the personal details apart.
 */
const defaultModel = "meta/muse-ember";
const defaultReasoning: Reasoning = "none";
const fallbackModels = ["anthropic/claude-haiku-5.5", "openai/gpt-6-luna"] as const;

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
