import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-chapters.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_COURSE_CHAPTERS ?? "openai/gpt-5";

const FALLBACK_MODELS = [
  "openai/gpt-5.2",
  "openai/gpt-5-mini",
  "openai/gpt-5.1-thinking",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-4.5",
];

const schema = z.object({
  chapters: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type CourseChaptersSchema = z.infer<typeof schema>;

export type CourseChaptersParams = {
  language: string;
  courseTitle: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseChapters({
  language,
  courseTitle,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: CourseChaptersParams) {
  const userPrompt = `
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
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
