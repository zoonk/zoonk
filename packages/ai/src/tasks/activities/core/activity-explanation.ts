import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { visualDescriptionSchema } from "../../steps/step-visual-descriptions";
import systemPrompt from "./activity-explanation.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const predictOptionSchema = z
  .object({
    feedback: z.string(),
    isCorrect: z.boolean(),
    text: z.string(),
  })
  .strict();

const anchorSchema = z
  .object({
    text: z.string(),
    title: z.string(),
  })
  .strict();

const conceptSchema = z
  .object({
    text: z.string(),
    title: z.string(),
    visual: visualDescriptionSchema.nullable(),
  })
  .strict();

const initialQuestionSchema = z
  .object({
    explanation: z.string(),
    question: z.string(),
    visual: visualDescriptionSchema,
  })
  .strict();

const predictSchema = z
  .object({
    concept: z.string(),
    options: z.array(predictOptionSchema),
    question: z.string(),
  })
  .strict();

const scenarioSchema = z
  .object({
    text: z.string(),
    title: z.string(),
  })
  .strict();

const schema = z
  .object({
    anchor: anchorSchema,
    concepts: z.array(conceptSchema),
    initialQuestion: initialQuestionSchema,
    predict: z.array(predictSchema),
    scenario: scenarioSchema,
  })
  .strict();

export type ActivityExplanationSchema = z.infer<typeof schema>;

export type ActivityExplanationParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  activityGoal: string;
  activityTitle: string;
  lessonConcepts: string[];
  otherActivityTitles: string[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateActivityExplanation({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  activityGoal,
  activityTitle,
  lessonConcepts,
  otherActivityTitles,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityExplanationParams) {
  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}
ACTIVITY_TITLE: ${activityTitle}
ACTIVITY_GOAL: ${activityGoal}
LESSON_CONCEPTS: ${lessonConcepts.join(", ")}
OTHER_EXPLANATION_ACTIVITY_TITLES: ${otherActivityTitles.join(", ")}`;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    model,
    reasoningEffort,
    taskName: "activity-explanation",
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
