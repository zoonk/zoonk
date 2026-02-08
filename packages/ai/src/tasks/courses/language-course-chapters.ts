import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./language-course-chapters.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_COURSE_CHAPTERS ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "anthropic/claude-opus-4.5",
  "google/gemini-3-pro-preview",
  "google/gemini-3-flash",
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
  courseTitle: string;
  language: string;
  targetLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLanguageCourseChapters({
  courseTitle,
  language,
  targetLanguage,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort = "high",
}: LanguageCourseChaptersParams) {
  const userPrompt = `
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
    TARGET_LANGUAGE: ${targetLanguage}
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
