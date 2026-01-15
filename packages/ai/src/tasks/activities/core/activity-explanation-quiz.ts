import "server-only";

import { generateText, stepCountIs } from "ai";
import { buildProviderOptions, type ReasoningEffort } from "../../../types";

import { type QuizQuestion, quizTools } from "../_tools/quiz";
import systemPrompt from "./activity-explanation-quiz.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_ACTIVITY_EXPLANATION_QUIZ ??
  "anthropic/claude-sonnet-4.5";

const FALLBACK_MODELS = [
  "anthropic/claude-opus-4.5",
  "openai/gpt-5.2",
  "google/gemini-3-flash",
  "openai/gpt-5-mini",
];

export type ActivityExplanationQuizSchema = {
  questions: QuizQuestion[];
};

export type ActivityExplanationQuizParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  explanationSteps: Array<{ title: string; text: string }>;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateActivityExplanationQuiz({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  explanationSteps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityExplanationQuizParams) {
  const formattedExplanationSteps = explanationSteps
    .map((step, index) => `${index + 1}. ${step.title}: ${step.text}`)
    .join("\n");

  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}
EXPLANATION_STEPS:
${formattedExplanationSteps}

Generate quiz questions that test understanding of these concepts. Use the available tools to create questions in appropriate formats. Aim for 4-8 questions covering the key concepts.`;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    reasoningEffort,
    useFallback,
  });

  const { steps, usage } = await generateText({
    model,
    prompt: userPrompt,
    providerOptions,
    stopWhen: stepCountIs(10),
    system: systemPrompt,
    toolChoice: "required",
    tools: quizTools,
  });

  // Collect all tool calls as questions
  const questions = steps.flatMap((step) =>
    step.toolCalls
      .filter((call) => !call.dynamic)
      .map((call) => ({
        format: call.toolName as QuizQuestion["format"],
        ...call.input,
      })),
  ) as QuizQuestion[];

  return { data: { questions }, systemPrompt, usage, userPrompt };
}
