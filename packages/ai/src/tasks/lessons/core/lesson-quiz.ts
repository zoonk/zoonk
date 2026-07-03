import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type SourceLesson, formatSourceLessonForPrompt } from "../_utils/source-lessons";
import systemPrompt from "./lesson-quiz.prompt.md";

const defaultModel = "openai/gpt-5.5";
const fallbackModels = ["google/gemini-3.1-pro-preview"] as const;
const maximumQuestions = 15;
const minimumQuestions = 5;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order; keep format first. */
const multipleChoiceSchema = z.object({
  format: z.literal("multipleChoice"),
  context: z.string(),
  question: z.string(),
  options: z.array(z.object({ feedback: z.string(), isCorrect: z.boolean(), text: z.string() })),
});

const fillBlankSchema = z.object({
  format: z.literal("fillBlank"),
  question: z.string(),
  template: z.string(),
  answers: z.array(z.string()),
  distractors: z.array(z.string()),
  feedback: z.string(),
});

const matchColumnsSchema = z.object({
  format: z.literal("matchColumns"),
  pairs: z
    .array(z.object({ left: z.string(), right: z.string() }))
    .min(2)
    .max(3),
  question: z.string(),
});

const sortOrderSchema = z.object({
  format: z.literal("sortOrder"),
  question: z.string(),
  items: z.array(z.string()),
  feedback: z.string(),
});

const selectImageSchema = z.object({
  format: z.literal("selectImage"),
  question: z.string(),
  options: z.array(z.object({ feedback: z.string(), isCorrect: z.boolean(), prompt: z.string() })),
});
/* oxlint-enable eslint/sort-keys */

const quizQuestionSchema = z.union([
  multipleChoiceSchema,
  fillBlankSchema,
  matchColumnsSchema,
  sortOrderSchema,
  selectImageSchema,
]);

const schema = z.object({
  questions: z.array(quizQuestionSchema).min(minimumQuestions).max(maximumQuestions),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type LessonQuizSchema = z.infer<typeof schema>;

export type LessonQuizParams = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  lesson: SourceLesson;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLessonQuiz({
  chapterTitle,
  courseTitle,
  language,
  lesson,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonQuizParams) {
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
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
