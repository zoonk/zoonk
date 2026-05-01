import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./chapter-lessons.prompt.md";

const defaultModel = "openai/gpt-5.5";

const fallbackModels = [
  "openai/gpt-5.4",
  "google/gemini-3.1-pro-preview",
  "anthropic/claude-opus-4.7",
] as const;

const schema = z.object({
  lessons: z.array(z.object({ description: z.string(), title: z.string() })),
});

type ChapterLessonsSchema = z.infer<typeof schema>;
export type ChapterLesson = ChapterLessonsSchema["lessons"][number];

function formatNeighboringChapters(chapters: { title: string; description: string }[]): string {
  if (chapters.length === 0) {
    return "";
  }

  const items = chapters.map((ch) => `- "${ch.title}": ${ch.description}`).join("\n");

  return `\nNEIGHBORING_CHAPTERS:\n${items}`;
}

export async function generateChapterLessons({
  chapterDescription,
  chapterTitle,
  courseTitle,
  language,
  neighboringChapters,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: {
  chapterDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  neighboringChapters?: { title: string; description: string }[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
}) {
  const neighboringSection = neighboringChapters
    ? formatNeighboringChapters(neighboringChapters)
    : "";

  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    LANGUAGE: ${promptLanguage}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
    CHAPTER_DESCRIPTION: ${chapterDescription}${neighboringSection}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
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
