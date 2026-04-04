import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-timeline.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_VISUAL_TIMELINE ?? "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["google/gemini-3-flash"];

/**
 * Matches `timelineVisualContentSchema` from `@zoonk/core/steps/contract/visual`.
 * Defined inline because `@zoonk/core` depends on `@zoonk/ai`,
 * so importing from core would create a circular dependency.
 */
const schema = z
  .object({
    events: z.array(
      z.object({
        date: z.string(),
        description: z.string(),
        title: z.string(),
      }),
    ),
  })
  .strict();

export type VisualTimelineSchema = z.infer<typeof schema>;

export type VisualTimelineParams = {
  description: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates structured timeline data from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateInvestigationVisual`) and produces timeline content
 * matching `timelineVisualContentSchema`: an array of chronological
 * events, each with a date, title, and description.
 */
export async function generateVisualTimeline({
  description,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: VisualTimelineParams) {
  const userPrompt = `
    VISUAL_DESCRIPTION: ${description}
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
