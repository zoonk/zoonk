import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ActivityInvestigationFindingsSchema } from "./activity-investigation-findings";
import { type ActivityInvestigationScenarioSchema } from "./activity-investigation-scenario";
import systemPrompt from "./activity-investigation-visuals.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_INVESTIGATION_VISUALS ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const visualKindSchema = z.enum([
  "chart",
  "code",
  "diagram",
  "formula",
  "image",
  "table",
  "timeline",
]);

const visualSchema = z.object({
  description: z.string(),
  kind: visualKindSchema,
});

const schema = z.object({
  findingVisuals: z.array(visualSchema),
  scenarioVisual: visualSchema,
});

export type ActivityInvestigationVisualsSchema = z.infer<typeof schema>;

export type ActivityInvestigationVisualsParams = {
  scenario: ActivityInvestigationScenarioSchema;
  findings: ActivityInvestigationFindingsSchema;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Formats the scenario and findings into a readable prompt block
 * so the AI can describe appropriate visuals for each piece of content.
 */
function formatInputsForPrompt({
  scenario,
  findings,
}: Pick<ActivityInvestigationVisualsParams, "scenario" | "findings">): string {
  const findingList = findings.findings.map((finding, index) => `${index}. ${finding}`).join("\n");

  return `
    SCENARIO: ${scenario.scenario}
    FINDINGS: ${findingList}
  `;
}

/**
 * Generates visual descriptions for an investigation's scenario
 * and findings. Produces a visual kind and description for the
 * scenario and one for each finding, with enough specificity for
 * a separate system to generate the actual visuals. This is phase 5
 * of investigation generation — runs in parallel with the conclusions
 * task after findings are ready.
 */
export async function generateActivityInvestigationVisuals({
  scenario,
  findings,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationVisualsParams) {
  const userPrompt = `
    ${formatInputsForPrompt({ findings, scenario })}
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
