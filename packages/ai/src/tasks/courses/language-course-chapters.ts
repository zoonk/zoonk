import "server-only";
import { getLanguageName } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./language-course-chapters.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_LANGUAGE_COURSE_CHAPTERS ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "google/gemini-3-flash",
  "google/gemini-3.1-pro-preview",
  "anthropic/claude-opus-4.6",
];

const schema = z.object({
  chapters: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type LanguageCourseChaptersSchema = z.infer<typeof schema>;

export type LanguageCourseChaptersParams = {
  userLanguage: string;
  targetLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLanguageCourseChapters({
  userLanguage,
  targetLanguage,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort = "high",
}: LanguageCourseChaptersParams) {
  const targetLanguageName = getLanguageName({ targetLanguage, userLanguage });

  const userPrompt = `
    USER_LANGUAGE: ${userLanguage}
    TARGET_LANGUAGE: ${targetLanguageName}
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
