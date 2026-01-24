import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../types";
import systemPrompt from "./alternative-titles.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ALTERNATIVE_TITLES ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "xai/grok-4-fast-reasoning",
  "google/gemini-2.5-flash",
  "meta/llama-4-maverick",
  "openai/gpt-4.1-mini",
];

const schema = z.object({
  alternatives: z.array(z.string()),
});

export type AlternativeTitlesSchema = z.infer<typeof schema>;

export type AlternativeTitlesParams = {
  title: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateAlternativeTitles({
  title,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: AlternativeTitlesParams) {
  const userPrompt = `
    TITLE: ${title}
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
