import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-tradeoff.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_TRADEOFF ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6"];

const MIN_ROUNDS = 2;
const MAX_ROUNDS = 4;

const outcomeSchema = z.object({
  invested: z.object({ consequence: z.string() }),
  maintained: z.object({ consequence: z.string() }),
  neglected: z.object({ consequence: z.string() }),
  priorityId: z.string(),
});

const stateModifierSchema = z.object({
  delta: z.number().int(),
  priorityId: z.string(),
});

const roundSchema = z.object({
  event: z.string().nullable(),
  outcomes: z.array(outcomeSchema),
  stateModifiers: z.array(stateModifierSchema).nullable(),
  tokenOverride: z.number().int().nullable(),
});

const schema = z.object({
  priorities: z.array(
    z.object({
      description: z.string(),
      id: z.string(),
      name: z.string(),
    }),
  ),
  reflection: z.object({
    text: z.string(),
    title: z.string(),
  }),
  resource: z.object({
    name: z.string(),
    total: z.number().int(),
  }),
  rounds: z.array(roundSchema).min(MIN_ROUNDS).max(MAX_ROUNDS),
  scenario: z.object({
    text: z.string(),
    title: z.string(),
  }),
});

export type ActivityTradeoffSchema = z.infer<typeof schema>;

export type ActivityTradeoffParams = {
  chapterTitle: string;
  courseTitle: string;
  explanationSteps: { title: string; text: string }[];
  language: string;
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  useFallback?: boolean;
};

export async function generateActivityTradeoff({
  chapterTitle,
  courseTitle,
  explanationSteps,
  language,
  lessonDescription,
  lessonTitle,
  model = DEFAULT_MODEL,
  reasoningEffort,
  useFallback = true,
}: ActivityTradeoffParams) {
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
