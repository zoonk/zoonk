import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./chapter-lessons.prompt.md";

const taskName = "chapter-lessons";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  lessons: z.array(
    z.object({
      concepts: z.array(z.string()),
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type ChapterLessonsSchema = z.infer<typeof schema>;
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

  const userPrompt = `
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
    CHAPTER_DESCRIPTION: ${chapterDescription}${neighboringSection}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    taskName,
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
