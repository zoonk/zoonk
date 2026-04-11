import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { INVESTIGATION_EXPERIMENT_COUNT } from "@zoonk/utils/activities";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ActivityInvestigationAccuracySchema } from "./activity-investigation-accuracy";
import systemPrompt from "./activity-investigation-actions.prompt.md";
import { type ActivityInvestigationScenarioSchema } from "./activity-investigation-scenario";

const DEFAULT_MODEL = "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3-flash"];

const schema = z.object({
  actions: z
    .array(
      z.object({
        label: z.string(),
        quality: z.enum(["critical", "useful", "weak"]),
      }),
    )
    .min(INVESTIGATION_EXPERIMENT_COUNT),
});

export type ActivityInvestigationActionsSchema = z.infer<typeof schema>;

export type ActivityInvestigationActionsParams = {
  scenario: ActivityInvestigationScenarioSchema;
  accuracy: ActivityInvestigationAccuracySchema;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Formats the scenario and accuracy tiers into a readable prompt block
 * so the AI can reference the mystery, explanations, and which is
 * correct when designing investigation actions.
 */
function formatInputsForPrompt({
  scenario,
  accuracy,
}: Pick<ActivityInvestigationActionsParams, "scenario" | "accuracy">): string {
  const explanations = scenario.explanations
    .map((exp, i) => `${i}. [${accuracy.accuracies[i]?.accuracy}] ${exp}`)
    .join("\n");

  return `
    SCENARIO: ${scenario.scenario}
    EXPLANATIONS: ${explanations}
  `;
}

/**
 * Generates investigation actions for a scenario.
 * Produces 5-6 actions with quality tiers (critical/useful/weak)
 * that represent different investigation angles. This is phase 2
 * of investigation generation — takes the scenario output as input.
 */
export async function generateActivityInvestigationActions({
  scenario,
  accuracy,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationActionsParams) {
  const userPrompt = `
    ${formatInputsForPrompt({ accuracy, scenario })}
    LANGUAGE: ${language}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    model,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
