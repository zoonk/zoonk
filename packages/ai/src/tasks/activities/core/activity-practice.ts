import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { ACTIVITY_OPTIONS_COUNT } from "../config";
import systemPrompt from "./activity-practice.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

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

export type ActivityPracticeSchema = z.infer<typeof schema>;

export type ActivityPracticeParams = {
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

export async function generateActivityPractice({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  explanationSteps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityPracticeParams) {
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
    model,
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
