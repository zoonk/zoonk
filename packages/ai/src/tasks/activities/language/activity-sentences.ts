import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import { buildProviderOptions, type ReasoningEffort } from "../../../types";
import systemPrompt from "./activity-sentences.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_ACTIVITY_SENTENCES ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "google/gemini-3-pro-preview",
  "openai/gpt-5-mini",
  "anthropic/claude-opus-4.5",
];

const schema = z.object({
  sentences: z.array(
    z.object({
      romanization: z.string(),
      sentence: z.string(),
      translation: z.string(),
    }),
  ),
});

export type ActivitySentencesSchema = z.infer<typeof schema>;

export type ActivitySentencesParams = {
  courseTitle: string;
  language: string;
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  useFallback?: boolean;
  words: string[];
};

export async function generateActivitySentences({
  courseTitle,
  language,
  lessonTitle,
  model = DEFAULT_MODEL,
  reasoningEffort,
  useFallback = true,
  words,
}: ActivitySentencesParams) {
  const userPrompt = `TARGET_LANGUAGE: ${courseTitle}
NATIVE_LANGUAGE: ${language}
LESSON_TITLE: ${lessonTitle}
VOCABULARY_WORDS: ${words.join(", ")}

Generate practice sentences using these vocabulary words in everyday situations.`;

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
