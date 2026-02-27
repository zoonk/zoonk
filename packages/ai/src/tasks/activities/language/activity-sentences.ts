import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-sentences.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_SENTENCES ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5-mini",
  "anthropic/claude-opus-4.5",
];

const schema = z.object({
  sentences: z.array(
    z.object({
      romanization: z.string().nullable(),
      sentence: z.string(),
      translation: z.string(),
    }),
  ),
});

export type ActivitySentencesSchema = z.infer<typeof schema>;

export type ActivitySentencesParams = {
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
  words: string[];
};

export async function generateActivitySentences({
  lessonTitle,
  model = DEFAULT_MODEL,
  reasoningEffort,
  targetLanguage,
  userLanguage,
  useFallback = true,
  words,
}: ActivitySentencesParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}
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
