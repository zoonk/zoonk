import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-investigation-interpretations.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_ACTIVITY_INVESTIGATION_INTERPRETATIONS ?? "openai/gpt-5.4";

const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

/**
 * Schema uses flat named fields instead of an array with quality
 * labels. The field order (overclaims → dismissive → best) is
 * intentional: models tend to front-load effort on earlier fields,
 * so placing best last counteracts the natural "best = longest"
 * bias during generation.
 */
const interpretationTierSchema = z.object({
  feedback: z.string(),
  text: z.string(),
});

const schema = z.object({
  best: interpretationTierSchema,
  dismissive: interpretationTierSchema,
  overclaims: interpretationTierSchema,
});

export type ActivityInvestigationInterpretationsSchema = z.infer<typeof schema>;

export type ActivityInvestigationInterpretationsParams = {
  scenario: string;
  explanation: string;
  finding: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates interpretation statements for a single finding from
 * one explanation's perspective. Produces 3 statements (best/
 * overclaims/dismissive) + feedback.
 *
 * One instance runs per finding per explanation, all in parallel.
 * This keeps each call tiny and eliminates count/order bugs that
 * happen when cheaper models try to generate all findings at once.
 */
export async function generateActivityInvestigationInterpretations({
  scenario,
  explanation,
  finding,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationInterpretationsParams) {
  const userPrompt = `
    SCENARIO: ${scenario}
    EXPLANATION: ${explanation}
    FINDING: ${finding}
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
