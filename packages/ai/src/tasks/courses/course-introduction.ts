import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-introduction.prompt.md";

const defaultModel = "openai/gpt-5.5";
const fallbackModels = ["anthropic/claude-opus-4.8", "openai/gpt-5.4"] as const;

const INTRODUCTION_LESSON_MIN_COUNT = 3;
const INTRODUCTION_LESSON_MAX_COUNT = 5;

const schema = z.object({
  chapter: z.object({ description: z.string(), title: z.string() }),
  lessons: z
    .array(z.object({ description: z.string(), title: z.string() }))
    .min(INTRODUCTION_LESSON_MIN_COUNT)
    .max(INTRODUCTION_LESSON_MAX_COUNT),
});

export type CourseIntroductionSchema = z.infer<typeof schema>;

export type CourseIntroductionParams = {
  courseTitle: string;
  language: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  useFallback?: boolean;
};

export async function generateCourseIntroduction({
  courseTitle,
  language,
  model = defaultModel,
  reasoningEffort,
  useFallback = true,
}: CourseIntroductionParams) {
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    LANGUAGE: ${promptLanguage}
    COURSE_TITLE: ${courseTitle}
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
