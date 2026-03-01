import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./chapter-lessons.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_CHAPTER_LESSONS ?? "openai/gpt-5.2";

const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "openai/gpt-5-mini"];

const DEFAULT_REASONING_EFFORT: ReasoningEffort = "high";

const schema = z.object({
  lessons: z.array(
    z.object({
      concepts: z.array(z.string()),
      description: z.string(),
      title: z.string(),
    }),
  ),
});

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
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
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

  const userPrompt = `
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
    CHAPTER_DESCRIPTION: ${chapterDescription}${neighboringSection}
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
