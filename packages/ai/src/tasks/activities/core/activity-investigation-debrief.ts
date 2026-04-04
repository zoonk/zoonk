import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ActivityInvestigationAccuracySchema } from "./activity-investigation-accuracy";
import { type ActivityInvestigationActionsSchema } from "./activity-investigation-actions";
import systemPrompt from "./activity-investigation-debrief.prompt.md";
import { type ActivityInvestigationFindingsSchema } from "./activity-investigation-findings";
import { type ActivityInvestigationScenarioSchema } from "./activity-investigation-scenario";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_INVESTIGATION_DEBRIEF ?? "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["google/gemini-3-flash", "anthropic/claude-sonnet-4.6"];

const schema = z.object({
  fullExplanation: z.string(),
});

export type ActivityInvestigationDebriefSchema = z.infer<typeof schema>;

export type ActivityInvestigationDebriefParams = {
  scenario: ActivityInvestigationScenarioSchema;
  accuracy: ActivityInvestigationAccuracySchema;
  actions: ActivityInvestigationActionsSchema;
  findings: ActivityInvestigationFindingsSchema;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Formats the scenario, accuracy tiers, actions, and findings into
 * a readable prompt block so the AI can reference the actual evidence
 * the learner investigated when writing the reveal.
 */
function formatInputsForPrompt({
  scenario,
  accuracy,
  actions,
  findings,
}: Pick<
  ActivityInvestigationDebriefParams,
  "scenario" | "accuracy" | "actions" | "findings"
>): string {
  const explanations = scenario.explanations
    .map((exp, i) => `${i}. [${accuracy.accuracies[i]}] ${exp}`)
    .join("\n");

  const actionList = actions.actions
    .map((action, i) => `${i}. ${action.label} → ${findings.findings[i]}`)
    .join("\n");

  return `
    SCENARIO: ${scenario.scenario}
    EXPLANATIONS: ${explanations}
    ACTIONS AND FINDINGS: ${actionList}
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
  actions,
  findings,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationDebriefParams) {
  const userPrompt = `
    ${formatInputsForPrompt({ accuracy, actions, findings, scenario })}
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
