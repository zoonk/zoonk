import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { buildProviderOptions, type ReasoningEffort } from "../../../types";
import systemPrompt from "./activity-review.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_REVIEW ?? "anthropic/claude-opus-4.5";

const FALLBACK_MODELS = [
  "google/gemini-3-pro-preview",
  "google/gemini-3-flash",
  "openai/gpt-5.2",
  "openai/gpt-5-mini",
];

const optionSchema = z.object({
  feedback: z.string(),
  isCorrect: z.boolean(),
  text: z.string(),
});

const questionSchema = z.object({
  context: z.string(),
  options: z.array(optionSchema).length(4),
  question: z.string(),
});

const schema = z.object({
  questions: z.array(questionSchema).min(15).max(20),
});

export type ActivityReviewSchema = z.infer<typeof schema>;

export type ActivityReviewParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  backgroundSteps: Array<{ title: string; text: string }>;
  explanationSteps: Array<{ title: string; text: string }>;
  mechanicsSteps: Array<{ title: string; text: string }>;
  examplesSteps: Array<{ title: string; text: string }>;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

function formatSteps(steps: Array<{ title: string; text: string }>): string {
  return steps.map((step, index) => `${index + 1}. ${step.title}: ${step.text}`).join("\n");
}

export async function generateActivityReview({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  backgroundSteps,
  explanationSteps,
  mechanicsSteps,
  examplesSteps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityReviewParams) {
  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}

BACKGROUND_STEPS:
${formatSteps(backgroundSteps)}

EXPLANATION_STEPS:
${formatSteps(explanationSteps)}

MECHANICS_STEPS:
${formatSteps(mechanicsSteps)}

EXAMPLES_STEPS:
${formatSteps(examplesSteps)}`;

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
