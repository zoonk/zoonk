import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-story-debrief.prompt.md";
import { type ActivityStoryStepsSchema } from "./activity-story-steps";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_STORY_DEBRIEF ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const storyOutcomeSchema = z.object({
  minStrongChoices: z.number().int().min(0),
  narrative: z.string(),
  title: z.string(),
});

const storyDebriefConceptSchema = z.object({
  explanation: z.string(),
  name: z.string(),
});

const schema = z.object({
  debrief: z.array(storyDebriefConceptSchema).min(1),
  outcomes: z.array(storyOutcomeSchema).min(1),
});

export type ActivityStoryDebriefSchema = z.infer<typeof schema>;

export type ActivityStoryDebriefParams = {
  storySteps: ActivityStoryStepsSchema;
  topic: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Formats metric changes into a compact readable string.
 * Example: "estoque: +10, caixa: -5"
 */
function formatMetricChanges(metricChanges: { metricId: string; delta: number }[]): string {
  return metricChanges
    .map(({ metricId, delta }) => `${metricId}: ${delta > 0 ? "+" : ""}${delta}`)
    .join(", ");
}

/**
 * Formats a single step with its choices into a readable block
 * so the AI can reference specific moments in the debrief.
 */
function formatStep(step: ActivityStoryStepsSchema["steps"][number], index: number): string {
  const choicesText = step.choices
    .map(
      (choice) =>
        `  - [${choice.id}] (${choice.alignment}) "${choice.text}" → ${choice.consequence} (${formatMetricChanges(choice.metricChanges)})`,
    )
    .join("\n");

  return `Step ${index + 1}: ${step.situation}\nChoices:\n${choicesText}`;
}

/**
 * Serializes the full story steps output into a readable format
 * for the debrief AI prompt.
 */
function formatStoryStepsForPrompt(storySteps: ActivityStoryStepsSchema): string {
  const formattedMetrics = storySteps.metrics
    .map((metric) => `  ${metric.label} (${metric.id}): starts at ${metric.initial}`)
    .join("\n");

  const formattedSteps = storySteps.steps.map(formatStep).join("\n\n");

  return `
    INTRO: ${storySteps.intro}
    METRICS: ${formattedMetrics}
    STEPS: ${formattedSteps}
  `;
}

/**
 * Generates the outcomes and debrief concepts for a story activity.
 * Takes the full steps output from `generateActivityStorySteps` and
 * produces outcome tiers (based on how many strong choices were made)
 * and educational debrief concepts that reveal the hidden lessons.
 * This is phase 2 of story generation.
 */
export async function generateActivityStoryDebrief({
  storySteps,
  topic,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityStoryDebriefParams) {
  const userPrompt = `
    TOPIC: ${topic}
    LANGUAGE: ${language}
    ${formatStoryStepsForPrompt(storySteps)}
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
