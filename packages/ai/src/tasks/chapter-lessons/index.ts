import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_CHAPTER_LESSONS ?? "openai/gpt-5.1-instant";

const FALLBACK_MODELS = [
  "google/gemini-2.5-flash",
  "openai/gpt-5-mini",
  "google/gemini-2.5-pro",
  "xai/grok-4",
  "openai/gpt-5.1-thinking",
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

export type ChapterLessonsSchema = z.infer<typeof schema>;

export type ChapterLessonsParams = {
  chapterDescription: string;
  chapterTitle: string;
  courseTitle: string;
  locale: string;
  model?: string;
  useFallback?: boolean;
};

export async function generateChapterLessons({
  chapterDescription,
  chapterTitle,
  courseTitle,
  locale,
  model = DEFAULT_MODEL,
  useFallback = true,
}: ChapterLessonsParams) {
  const userPrompt = `
    LANGUAGE: ${locale}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
    CHAPTER_DESCRIPTION: ${chapterDescription}
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
