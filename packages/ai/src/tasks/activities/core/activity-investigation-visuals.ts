import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-investigation-visuals.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_INVESTIGATION_VISUALS ?? "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["google/gemini-3-flash"];

const visualKindSchema = z.enum([
  "chart",
  "code",
  "diagram",
  "formula",
  "image",
  "table",
  "timeline",
]);

const schema = z.object({
  description: z.string(),
  kind: visualKindSchema,
});

export type ActivityInvestigationVisualSchema = z.infer<typeof schema>;

export type ActivityInvestigationVisualParams = {
  scenario: string;
  finding?: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates a visual description for a single piece of investigation
 * content — either the scenario or one finding. Produces a visual
 * kind and description with enough specificity for a separate system
 * to generate the actual visual.
 *
 * When `finding` is provided, generates a finding visual with the
 * scenario as context. When omitted, generates a scenario visual.
 * One instance runs per item, all in parallel. This keeps each call
 * focused and eliminates quality degradation from generating many
 * visuals in a single batch.
 */
export async function generateInvestigationVisual({
  scenario,
  finding,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationVisualParams) {
  const findingBlock = finding ? `\n    FINDING: ${finding}` : "";

  const userPrompt = `
    SCENARIO: ${scenario}${findingBlock}
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
