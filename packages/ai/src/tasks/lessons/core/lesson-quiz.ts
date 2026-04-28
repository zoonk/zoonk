import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatExplanationStepsForPrompt } from "./_utils/format-explanation-steps";
import systemPrompt from "./lesson-quiz.prompt.md";

const taskName = "lesson-quiz";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

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
export type LessonQuizSchema = z.infer<typeof schema>;

export type LessonQuizParams = {
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

export async function generateLessonQuiz({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  explanationSteps,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonQuizParams) {
  const formattedExplanationSteps = formatExplanationStepsForPrompt(explanationSteps);

  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${language}
    EXPLANATION_STEPS: ${formattedExplanationSteps}
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
