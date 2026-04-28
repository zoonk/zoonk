import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatExplanationStepsForPrompt } from "./_utils/format-explanation-steps";
import systemPrompt from "./lesson-practice.prompt.md";

const taskName = "lesson-practice";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

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
  scenario: z.object({
    imagePrompt: z.string(),
    text: z.string(),
    title: z.string(),
  }),
  steps: z.array(practiceStepSchema),
  title: z.string(),
});

export type LessonPracticeSchema = z.infer<typeof schema>;

export type LessonPracticeParams = {
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

export async function generateLessonPractice({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  explanationSteps,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonPracticeParams) {
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
