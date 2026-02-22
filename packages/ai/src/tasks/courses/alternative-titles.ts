import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./alternative-titles.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ALTERNATIVE_TITLES || "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "openai/gpt-5-mini",
  "anthropic/claude-opus-4.6",
  "anthropic/claude-sonnet-4.6",
  "google/gemini-3.1-pro-preview",
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
