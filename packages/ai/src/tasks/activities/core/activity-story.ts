import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../../provider-options";
import { ACTIVITY_OPTIONS_COUNT } from "../constants";
import systemPrompt from "./activity-story.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_STORY ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "anthropic/claude-opus-4.5",
  "openai/gpt-5-mini",
  "google/gemini-3-pro-preview",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
];

const schema = z.object({
  steps: z.array(
    z.object({
      context: z.string(),
      options: z
        .array(
          z.object({
            feedback: z.string(),
            isCorrect: z.boolean(),
            text: z.string(),
          }),
        )
        .length(ACTIVITY_OPTIONS_COUNT),
      question: z.string(),
    }),
  ),
});

export type ActivityStorySchema = z.infer<typeof schema>;

export type ActivityStoryParams = {
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

export async function generateActivityStory({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  explanationSteps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityStoryParams) {
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
