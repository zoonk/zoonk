import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-quiz.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6"];

const multipleChoiceSchema = z.object({
  context: z.string(),
  format: z.literal("multipleChoice"),
  options: z.array(
    z.object({
      feedback: z.string(),
      isCorrect: z.boolean(),
      text: z.string(),
    }),
  ),
  question: z.string(),
});

const fillBlankSchema = z.object({
  answers: z.array(z.string()),
  distractors: z.array(z.string()),
  feedback: z.string(),
  format: z.literal("fillBlank"),
  question: z.string(),
  template: z.string(),
});

const matchColumnsSchema = z.object({
  format: z.literal("matchColumns"),
  pairs: z.array(
    z.object({
      left: z.string(),
      right: z.string(),
    }),
  ),
  question: z.string(),
});

const sortOrderSchema = z.object({
  feedback: z.string(),
  format: z.literal("sortOrder"),
  items: z.array(z.string()),
  question: z.string(),
});

const selectImageSchema = z.object({
  format: z.literal("selectImage"),
  options: z.array(
    z.object({
      feedback: z.string(),
      isCorrect: z.boolean(),
      prompt: z.string(),
    }),
  ),
  question: z.string(),
});

const quizQuestionSchema = z.union([
  multipleChoiceSchema,
  fillBlankSchema,
  matchColumnsSchema,
  sortOrderSchema,
  selectImageSchema,
]);

const schema = z.object({
  questions: z.array(quizQuestionSchema),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type SelectImageQuestion = z.infer<typeof selectImageSchema>;
export type ActivityQuizSchema = z.infer<typeof schema>;

export type ActivityQuizParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  explanationSteps: { title: string; text: string }[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateActivityQuiz({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  explanationSteps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityQuizParams) {
  const formattedExplanationSteps = explanationSteps
    .map((step, index) => `${index + 1}. ${step.title}: ${step.text}`)
    .join("\n");

  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}
EXPLANATION_STEPS:
${formattedExplanationSteps}`;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    model,
    reasoningEffort,
    taskName: "activity-quiz",
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
