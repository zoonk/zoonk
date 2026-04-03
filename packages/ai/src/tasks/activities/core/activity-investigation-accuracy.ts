import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-investigation-accuracy.prompt.md";
import { type ActivityInvestigationScenarioSchema } from "./activity-investigation-scenario";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_INVESTIGATION_ACCURACY ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const schema = z.object({
  accuracies: z.array(z.enum(["best", "partial", "wrong"])),
});

export type ActivityInvestigationAccuracySchema = z.infer<typeof schema>;

export type ActivityInvestigationAccuracyParams = {
  scenario: ActivityInvestigationScenarioSchema;
  topic: string;
  concepts: string[];
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Formats the scenario and lesson context into a readable prompt block
 * so the AI can judge each explanation's accuracy using domain knowledge.
 */
function formatInputsForPrompt({
  scenario,
  topic,
  concepts,
}: Pick<ActivityInvestigationAccuracyParams, "scenario" | "topic" | "concepts">): string {
  const explanations = scenario.explanations.map((exp, i) => `${i}. ${exp}`).join("\n");

  return `
    SCENARIO: ${scenario.scenario}
    EXPLANATIONS: ${explanations}
    TOPIC: ${topic}
    CONCEPTS: ${concepts.join(", ")}
  `;
}

/**
 * Assigns accuracy tiers (best/partial/wrong) to each explanation
 * in a scenario. This runs as a separate task after scenario generation
 * to avoid length bias — the scenario task writes explanations without
 * knowing which is "best," and this task classifies them afterwards.
 */
export async function generateActivityInvestigationAccuracy({
  scenario,
  topic,
  concepts,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationAccuracyParams) {
  const userPrompt = `
    ${formatInputsForPrompt({ concepts, scenario, topic })}
    LANGUAGE: ${language}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
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
