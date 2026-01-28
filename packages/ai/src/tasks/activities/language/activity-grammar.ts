import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./activity-grammar.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_GRAMMAR ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "openai/gpt-5.2",
  "google/gemini-3-pro-preview",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-5-mini",
  "anthropic/claude-opus-4.5",
];

const schema = z.object({
  discovery: z.object({
    options: z.array(
      z.object({
        feedback: z.string(),
        isCorrect: z.boolean(),
        text: z.string(),
      }),
    ),
    question: z.string(),
  }),
  examples: z.array(
    z.object({
      highlight: z.string(),
      romanization: z.string(),
      sentence: z.string(),
      translation: z.string(),
    }),
  ),
  exercises: z.array(
    z.object({
      answers: z.array(z.string()),
      distractors: z.array(z.string()),
      feedback: z.string(),
      template: z.string(),
    }),
  ),
  ruleName: z.string(),
  ruleSummary: z.string(),
});

export type ActivityGrammarSchema = z.infer<typeof schema>;

export type ActivityGrammarParams = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  useFallback?: boolean;
};

export async function generateActivityGrammar({
  chapterTitle,
  courseTitle,
  language,
  lessonDescription,
  lessonTitle,
  model = DEFAULT_MODEL,
  reasoningEffort = "high",
  useFallback = true,
}: ActivityGrammarParams) {
  const userPrompt = `TARGET_LANGUAGE: ${courseTitle}
NATIVE_LANGUAGE: ${language}
CHAPTER_TITLE: ${chapterTitle}
LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}

Generate a Pattern Discovery grammar activity for this lesson. Include 3-4 examples demonstrating the grammar pattern, a discovery question, a brief rule summary, and 2-3 fill-in-the-blank practice exercises.`;

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
