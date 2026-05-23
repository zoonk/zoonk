import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { appendLessonRichTextPrompt } from "../_utils/append-lesson-rich-text-prompt";
import { type SourceLesson, formatSourceLessonsForPrompt } from "./_utils/source-lessons";
import baseSystemPrompt from "./lesson-practice.prompt.md";

const defaultModel = "openai/gpt-5.5";
const fallbackModels = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"] as const;
const systemPrompt = appendLessonRichTextPrompt(baseSystemPrompt);

const practiceOptionSchema = z.object({
  feedback: z.string(),
  isCorrect: z.boolean(),
  text: z.string(),
});

const practiceStepSchema = z.object({
  context: z.string(),
  imagePrompt: z.string(),
  options: z.array(practiceOptionSchema).min(1),
  question: z.string(),
});

const schema = z.object({
  scenario: z.object({ imagePrompt: z.string(), text: z.string(), title: z.string() }),
  steps: z.array(practiceStepSchema).min(1),
  title: z.string(),
});

export type LessonPracticeSchema = z.infer<typeof schema>;

export type LessonPracticeParams = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  sourceLessons: SourceLesson[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLessonPractice({
  chapterTitle,
  courseTitle,
  language,
  sourceLessons,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonPracticeParams) {
  const formattedSourceLessons = formatSourceLessonsForPrompt(sourceLessons);
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${promptLanguage}
    SOURCE_LESSONS:
    ${formattedSourceLessons}
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
