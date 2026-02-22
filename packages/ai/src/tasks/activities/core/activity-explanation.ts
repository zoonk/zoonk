import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-explanation.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_EXPLANATION ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "anthropic/claude-opus-4.6",
  "anthropic/claude-opus-4.5",
  "openai/gpt-5-mini",
  "google/gemini-3-pro-preview",
];

const schema = z.object({
  steps: z.array(
    z.object({
      text: z.string(),
      title: z.string(),
    }),
  ),
});

export type ActivityExplanationSchema = z.infer<typeof schema>;

export type ActivityExplanationParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  backgroundSteps: { title: string; text: string }[];
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
  backgroundSteps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityExplanationParams) {
  const formattedBackgroundSteps = backgroundSteps
    .map((step, index) => `${index + 1}. ${step.title}: ${step.text}`)
    .join("\n");

  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}
BACKGROUND_STEPS:
${formattedBackgroundSteps}`;

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
