import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import { buildProviderOptions, type ReasoningEffort } from "../../../types";
import systemPrompt from "./activity-story.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_ACTIVITY_STORY_LANGUAGE ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "openai/gpt-5.2",
  "google/gemini-3-pro-preview",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-5-mini",
  "anthropic/claude-opus-4.5",
];

const schema = z.object({
  scenario: z.string(),
  steps: z.array(
    z.object({
      context: z.string(),
      contextRomanization: z.string(),
      contextTranslation: z.string(),
      options: z
        .array(
          z.object({
            feedback: z.string(),
            isCorrect: z.boolean(),
            text: z.string(),
            textRomanization: z.string(),
          }),
        )
        .length(4),
      question: z.string(),
    }),
  ),
});

export type ActivityStoryLanguageSchema = z.infer<typeof schema>;

export type ActivityStoryLanguageParams = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  useFallback?: boolean;
};

export async function generateActivityStoryLanguage({
  chapterTitle,
  courseTitle,
  language,
  lessonDescription,
  lessonTitle,
  model = DEFAULT_MODEL,
  reasoningEffort = "high",
  useFallback = true,
}: ActivityStoryLanguageParams) {
  const userPrompt = `TARGET_LANGUAGE: ${courseTitle}
NATIVE_LANGUAGE: ${language}
CHAPTER_TITLE: ${chapterTitle}
LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}

Generate an immersive dialogue-driven story activity for this language lesson. Create a realistic everyday scenario where learners practice language production in situations they'd face in a foreign country.`;

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
