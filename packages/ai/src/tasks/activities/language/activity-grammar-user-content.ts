import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-grammar-user-content.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3-flash"];

const schema = z.object({
  discovery: z.object({
    context: z.string().nullable(),
    options: z.array(
      z.object({
        feedback: z.string(),
        isCorrect: z.boolean(),
        text: z.string(),
      }),
    ),
    question: z.string().nullable(),
  }),
  exampleTranslations: z.array(z.string()),
  exerciseFeedback: z.array(z.string()),
  exerciseQuestions: z.array(z.string().nullable()),
  exerciseTranslations: z.array(z.string()),
  ruleName: z.string(),
  ruleSummary: z.string(),
});

export type ActivityGrammarUserContentSchema = z.infer<typeof schema>;

export type ActivityGrammarUserContentParams = {
  chapterTitle: string;
  examples: { highlight: string; sentence: string }[];
  exercises: { answer: string; distractors: string[]; template: string }[];
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  useFallback?: boolean;
  userLanguage: string;
};

/**
 * Generates USER_LANGUAGE content for a grammar activity.
 *
 * The grammar content task produces TARGET_LANGUAGE examples and exercises.
 * This task takes that output as read-only context and generates all
 * USER_LANGUAGE content: translations, discovery question, rule summary,
 * and exercise feedback. Splitting generation this way keeps each AI call
 * focused on one language, which reduces language mixing errors.
 */
export async function generateActivityGrammarUserContent({
  chapterTitle,
  examples,
  exercises,
  lessonDescription,
  lessonTitle,
  model = DEFAULT_MODEL,
  reasoningEffort,
  targetLanguage,
  useFallback = true,
  userLanguage,
}: ActivityGrammarUserContentParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}
CHAPTER_TITLE: ${chapterTitle}
LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}

EXAMPLES:
${JSON.stringify(examples, null, 2)}

EXERCISES:
${JSON.stringify(exercises, null, 2)}`;

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
