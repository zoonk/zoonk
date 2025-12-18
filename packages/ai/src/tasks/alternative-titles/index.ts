import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_ALTERNATIVE_TITLES || "google/gemini-3-flash";

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
  locale: string;
  model?: string;
  useFallback?: boolean;
};

export async function generateAlternativeTitles({
  title,
  locale,
  model = DEFAULT_MODEL,
  useFallback = true,
}: AlternativeTitlesParams) {
  const userPrompt = `
    TITLE: ${title}
    LANGUAGE: ${locale}
  `;

  const { object, usage } = await generateObject({
    model,
    prompt: userPrompt,
    providerOptions: {
      gateway: { models: useFallback ? FALLBACK_MODELS : [] },
    },
    schema,
    system: systemPrompt,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}
