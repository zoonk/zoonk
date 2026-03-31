import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-story-steps.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_STORY_STEPS ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const storyAlignmentSchema = z.enum(["strong", "partial", "weak"]);

const storyMetricSchema = z.object({
  id: z.string(),
  initial: z.number(),
  label: z.string(),
});

const storyChoiceSchema = z.object({
  alignment: storyAlignmentSchema,
  consequence: z.string(),
  id: z.string(),
  metricChanges: z.record(z.string(), z.number()),
  text: z.string(),
});

const storyStepSchema = z.object({
  choices: z.array(storyChoiceSchema).min(2),
  situation: z.string(),
});

const schema = z.object({
  intro: z.string(),
  metrics: z.array(storyMetricSchema).min(1),
  steps: z.array(storyStepSchema).min(1),
});

export type ActivityStoryStepsSchema = z.infer<typeof schema>;

export type ActivityStoryStepsParams = {
  topic: string;
  language: string;
  concepts: string[];
  courseTitle?: string;
  chapterTitle?: string;
  lessonDescription?: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates the interactive story steps for a story activity.
 * Produces an intro, metrics, and decision steps where each choice
 * has consequences and a hidden alignment tag (strong/partial/weak).
 * This is phase 1 of story generation — the debrief (phase 2)
 * takes this output as input.
 */
export async function generateActivityStorySteps({
  topic,
  language,
  concepts,
  courseTitle,
  chapterTitle,
  lessonDescription,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityStoryStepsParams) {
  const userPrompt = `
    TOPIC: ${topic}
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle ?? ""}
    CHAPTER_TITLE: ${chapterTitle ?? ""}
    LESSON_DESCRIPTION: ${lessonDescription ?? ""}
    CONCEPTS: ${concepts.join(", ")}
  `;

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
