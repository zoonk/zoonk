import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import { buildProviderOptions, type ReasoningEffort } from "../../../types";
import systemPrompt from "./activity-challenge.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_ACTIVITY_CHALLENGE ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "anthropic/claude-opus-4.5",
  "openai/gpt-5-mini",
  "google/gemini-3-pro-preview",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
];

const effectSchema = z.object({
  change: z.number(),
  variable: z.string(),
});

const optionSchema = z.object({
  effects: z.array(effectSchema),
  feedback: z.string(),
  text: z.string(),
});

const stepSchema = z.object({
  context: z.string(),
  options: z.array(optionSchema),
  question: z.string(),
});

const winConditionSchema = z.object({
  operator: z.enum(["gte", "lte", "gt", "lt", "eq"]),
  value: z.number(),
});

const inventoryItemSchema = z.object({
  name: z.string(),
  startValue: z.number(),
  winConditions: z.array(winConditionSchema).min(1),
});

const schema = z.object({
  intro: z.string(),
  inventory: z.array(inventoryItemSchema),
  steps: z.array(stepSchema),
});

export type ActivityChallengeSchema = z.infer<typeof schema>;

export type ActivityChallengeParams = {
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

export async function generateActivityChallenge({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  explanationSteps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityChallengeParams) {
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
