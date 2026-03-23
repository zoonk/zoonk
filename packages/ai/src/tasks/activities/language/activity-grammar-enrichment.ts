import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-grammar-enrichment.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_GRAMMAR_ENRICHMENT ?? "google/gemini-3-flash";
const FALLBACK_MODELS = ["anthropic/claude-sonnet-4.6", "openai/gpt-5.4"];

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

export type ActivityGrammarEnrichmentSchema = z.infer<typeof schema>;

export type ActivityGrammarEnrichmentParams = {
  chapterTitle: string;
  examples: { highlight: string; sentence: string }[];
  exercises: { answers: string[]; distractors: string[]; template: string }[];
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  useFallback?: boolean;
  userLanguage: string;
};

/**
 * Generates USER_LANGUAGE enrichment content for a grammar activity.
 *
 * The grammar content task produces TARGET_LANGUAGE examples and exercises.
 * This enrichment task takes that output as read-only context and generates
 * all USER_LANGUAGE content: translations, discovery question, rule summary,
 * and exercise feedback. Splitting generation this way keeps each AI call
 * focused on one language, which reduces language mixing errors.
 */
export async function generateActivityGrammarEnrichment({
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
}: ActivityGrammarEnrichmentParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}
CHAPTER_TITLE: ${chapterTitle}
LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}

EXAMPLES:
${JSON.stringify(examples, null, 2)}

EXERCISES:
${JSON.stringify(exercises, null, 2)}

Generate all USER_LANGUAGE enrichment content for this grammar activity: translations for examples and exercises, a discovery question with options, a rule name and summary, exercise questions and feedback.`;

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
