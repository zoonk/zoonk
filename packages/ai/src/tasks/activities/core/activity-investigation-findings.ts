import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ActivityInvestigationAccuracySchema } from "./activity-investigation-accuracy";
import { type ActivityInvestigationActionsSchema } from "./activity-investigation-actions";
import systemPrompt from "./activity-investigation-findings.prompt.md";
import { type ActivityInvestigationScenarioSchema } from "./activity-investigation-scenario";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_INVESTIGATION_FINDINGS ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["google/gemini-3.1-pro-preview", "anthropic/claude-sonnet-4.6"];

/**
 * Builds a schema that enforces the findings array length
 * matches the number of actions. A wrong-length output
 * is structurally broken — findings can't be mapped back to
 * actions — so we fail fast instead of silently misaligning.
 */
function buildSchema(actionCount: number) {
  return z.object({
    findings: z.array(z.string()).length(actionCount),
  });
}

export type ActivityInvestigationFindingsSchema = z.infer<ReturnType<typeof buildSchema>>;

export type ActivityInvestigationFindingsParams = {
  scenario: ActivityInvestigationScenarioSchema;
  accuracy: ActivityInvestigationAccuracySchema;
  actions: ActivityInvestigationActionsSchema;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Formats the scenario, accuracy tiers, and actions into a readable
 * prompt block so the AI can craft findings that are consistent with
 * the mystery and deliberately ambiguous relative to the truth.
 */
function formatInputsForPrompt({
  scenario,
  accuracy,
  actions,
}: Pick<ActivityInvestigationFindingsParams, "scenario" | "accuracy" | "actions">): string {
  const explanations = scenario.explanations
    .map((exp, i) => `${i}. [${accuracy.accuracies[i]}] ${exp}`)
    .join("\n");

  const actionList = actions.actions
    .map((action, i) => `${i}. ${action.label} (${action.quality})`)
    .join("\n");

  return `
    SCENARIO: ${scenario.scenario}
    EXPLANATIONS: ${explanations}
    ACTIONS: ${actionList}
  `;
}

/**
 * Generates findings for each investigation action.
 * Produces deliberately ambiguous evidence text — each finding
 * has a complicating factor that makes interpretation non-trivial.
 * This is phase 3 of investigation generation — takes scenario
 * and actions outputs as input. Interpretation statements for
 * each finding are generated separately per explanation.
 */
export async function generateActivityInvestigationFindings({
  scenario,
  accuracy,
  actions,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationFindingsParams) {
  const userPrompt = `
    ${formatInputsForPrompt({ accuracy, actions, scenario })}
    LANGUAGE: ${language}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    reasoningEffort,
    useFallback,
  });

  const schema = buildSchema(actions.actions.length);

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
