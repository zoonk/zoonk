import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-investigation-accuracy.prompt.md";
import { type ActivityInvestigationScenarioSchema } from "./activity-investigation-scenario";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_INVESTIGATION_ACCURACY ?? "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["google/gemini-3.1-flash-lite-preview", "anthropic/claude-sonnet-4.6"];

/**
 * Builds a schema that enforces the accuracy array length
 * matches the number of explanations. A wrong-length output
 * is structurally broken — tiers can't be mapped back to
 * explanations — so we fail fast instead of silently misaligning.
 *
 * Each entry pairs an accuracy tier with a feedback message
 * explaining WHY this explanation is best/partial/wrong.
 * This replaces the standalone debrief task — learners now
 * see feedback specific to the explanation they picked.
 */
function buildSchema(explanationCount: number) {
  return z.object({
    accuracies: z
      .array(
        z.object({
          accuracy: z.enum(["best", "partial", "wrong"]),
          feedback: z.string(),
        }),
      )
      .length(explanationCount),
  });
}

export type ActivityInvestigationAccuracySchema = z.infer<ReturnType<typeof buildSchema>>;

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
    EXPLANATION_COUNT: ${scenario.explanations.length}
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

  const schema = buildSchema(scenario.explanations.length);

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
