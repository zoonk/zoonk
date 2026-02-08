import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./language-chapter-lessons.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_CHAPTER_LESSONS ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "google/gemini-3-pro-preview",
  "google/gemini-3-flash",
  "anthropic/claude-sonnet-4.5",
];

const schema = z.object({
  lessons: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type LanguageChapterLessonsSchema = z.infer<typeof schema>;

export type LanguageChapterLessonsParams = {
  chapterDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  targetLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLanguageChapterLessons({
  chapterDescription,
  chapterTitle,
  courseTitle,
  language,
  targetLanguage,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: LanguageChapterLessonsParams) {
  const userPrompt = `
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
    CHAPTER_DESCRIPTION: ${chapterDescription}
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
