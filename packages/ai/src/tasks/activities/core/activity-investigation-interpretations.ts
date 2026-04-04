import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ActivityInvestigationFindingsSchema } from "./activity-investigation-findings";
import systemPrompt from "./activity-investigation-interpretations.prompt.md";
import { type ActivityInvestigationScenarioSchema } from "./activity-investigation-scenario";

const DEFAULT_MODEL =
  process.env.AI_MODEL_ACTIVITY_INVESTIGATION_INTERPRETATIONS ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const schema = z.object({
  interpretations: z.array(
    z.object({
      feedback: z.string(),
      statements: z.array(
        z.object({
          quality: z.enum(["best", "overclaims", "dismissive"]),
          text: z.string(),
        }),
      ),
    }),
  ),
});

export type ActivityInvestigationInterpretationsSchema = z.infer<typeof schema>;

export type ActivityInvestigationInterpretationsParams = {
  scenario: ActivityInvestigationScenarioSchema;
  findings: ActivityInvestigationFindingsSchema;
  explanationIndex: number;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Formats the scenario, specific explanation, and findings into a
 * readable prompt block so the AI can write interpretations from
 * one explanation's perspective.
 */
function formatInputsForPrompt({
  scenario,
  findings,
  explanationIndex,
}: Pick<
  ActivityInvestigationInterpretationsParams,
  "scenario" | "findings" | "explanationIndex"
>): string {
  const findingList = findings.findings.map((finding, i) => `${i}. ${finding}`).join("\n");

  return `
    SCENARIO: ${scenario.scenario}
    EXPLANATION: ${scenario.explanations[explanationIndex]}
    FINDINGS: ${findingList}
  `;
}

/**
 * Generates interpretation statements for each finding from one
 * explanation's perspective. Produces 3 statements (best/overclaims/
 * dismissive) + feedback per finding.
 *
 * One instance of this task runs per explanation, all in parallel.
 * This keeps each call small and lets the AI deeply inhabit one
 * perspective rather than switching between explanations.
 */
export async function generateActivityInvestigationInterpretations({
  scenario,
  findings,
  explanationIndex,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationInterpretationsParams) {
  const userPrompt = `
    ${formatInputsForPrompt({ explanationIndex, findings, scenario })}
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
