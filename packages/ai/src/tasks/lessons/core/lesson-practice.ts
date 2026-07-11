import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { appendLessonRichTextPrompt } from "../_utils/append-lesson-rich-text-prompt";
import { type SourceLesson, formatSourceLessonForPrompt } from "../_utils/source-lessons";
import baseSystemPrompt from "./lesson-practice.prompt.md";

const defaultModel = "openai/gpt-5.6-sol";
const fallbackModels = ["anthropic/claude-sonnet-5", "openai/gpt-5.5"] as const;
const systemPrompt = appendLessonRichTextPrompt(baseSystemPrompt);

const practiceOptionSchema = z.object({
  feedback: z.string(),
  isCorrect: z.boolean(),
  text: z.string(),
});

const practiceSituationSchema = z.object({
  dialogue: z.string(),
  imagePrompt: z.string(),
  options: z.array(practiceOptionSchema).min(1),
  question: z.string(),
});

const schema = z.object({ situations: z.array(practiceSituationSchema).min(1) });

export type LessonPracticeSchema = z.infer<typeof schema>;

export type LessonPracticeParams = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  lesson: SourceLesson;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLessonPractice({
  chapterTitle,
  courseTitle,
  language,
  lesson,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonPracticeParams) {
  const formattedLesson = formatSourceLessonForPrompt(lesson);
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${promptLanguage}
    LESSON: ${formattedLesson}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
