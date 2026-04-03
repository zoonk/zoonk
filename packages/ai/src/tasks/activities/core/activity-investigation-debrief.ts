import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ActivityInvestigationAccuracySchema } from "./activity-investigation-accuracy";
import systemPrompt from "./activity-investigation-debrief.prompt.md";
import { type ActivityInvestigationScenarioSchema } from "./activity-investigation-scenario";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_INVESTIGATION_DEBRIEF ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const schema = z.object({
  fullExplanation: z.string(),
});

export type ActivityInvestigationDebriefSchema = z.infer<typeof schema>;

export type ActivityInvestigationDebriefParams = {
  scenario: ActivityInvestigationScenarioSchema;
  accuracy: ActivityInvestigationAccuracySchema;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Formats the scenario and accuracy tiers into a readable prompt block
 * so the AI knows which explanation is correct when writing the reveal.
 */
function formatInputsForPrompt({
  scenario,
  accuracy,
}: Pick<ActivityInvestigationDebriefParams, "scenario" | "accuracy">): string {
  const explanations = scenario.explanations
    .map((exp, i) => `${i}. [${accuracy.accuracies[i]}] ${exp}`)
    .join("\n");

  return `
    SCENARIO: ${scenario.scenario}
    EXPLANATIONS: ${explanations}
  `;
}

/**
 * Generates the debrief explanation for an investigation.
 * Produces a 2-3 sentence reveal of what actually happened
 * and why — the "aha moment" shown after the learner makes
 * their final call. This is phase 4 of investigation generation —
 * runs in parallel with visuals and interpretations after findings.
 */
export async function generateActivityInvestigationDebrief({
  scenario,
  accuracy,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationDebriefParams) {
  const userPrompt = `
    ${formatInputsForPrompt({ accuracy, scenario })}
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
