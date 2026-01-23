import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { buildProviderOptions, type ReasoningEffort } from "../../../types";
import systemPrompt from "./activity-pronunciation.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_PRONUNCIATION ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-4.5",
  "google/gemini-3-pro-preview",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5.1-instant",
  "openai/gpt-5.2",
  "openai/gpt-5-mini",
];

const schema = z.object({
  pronunciation: z.string(),
});

export type ActivityPronunciationSchema = z.infer<typeof schema>;

export type ActivityPronunciationParams = {
  model?: string;
  nativeLanguage: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  useFallback?: boolean;
  word: string;
};

export async function generateActivityPronunciation({
  model = DEFAULT_MODEL,
  nativeLanguage,
  reasoningEffort,
  targetLanguage,
  useFallback = true,
  word,
}: ActivityPronunciationParams) {
  const userPrompt = `WORD: ${word}
TARGET_LANGUAGE: ${targetLanguage}
NATIVE_LANGUAGE: ${nativeLanguage}

Generate a pronunciation guide for this word using only sounds from the native language.`;

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
