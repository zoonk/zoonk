import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type LearningContext, formatLearningContext } from "../../_utils/learning-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { insertLessonFeedbackPrompt } from "../_utils/append-lesson-feedback-prompt";
import { type SourceLesson, formatSourceLessonForPrompt } from "../_utils/source-lessons";
import baseSystemPrompt from "./lesson-quiz.prompt.md";

const defaultModel = "openai/gpt-5.5";

const fallbackModels = [
  "openai/gpt-5.6-sol",
  "anthropic/claude-opus-4.8",
  "google/gemini-3.1-pro-preview",
] as const;

const systemPrompt = insertLessonFeedbackPrompt(baseSystemPrompt);

const maximumQuestions = 4;
const minimumQuestions = 2;

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
  learningContext?: LearningContext;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

export async function generateLessonQuiz({
  chapterTitle,
  courseTitle,
  language,
  lesson,
  learningContext,
  model = defaultModel,
  useFallback = true,
  reasoning,
}: LessonQuizParams) {
  const formattedLesson = formatSourceLessonForPrompt(lesson);
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${promptLanguage}
    LESSON: ${formattedLesson}
    LEARNING_CONTEXT: ${formatLearningContext(learningContext)}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
