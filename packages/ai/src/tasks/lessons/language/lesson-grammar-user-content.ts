import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./lesson-grammar-user-content.prompt.md";

const defaultModel = "openai/gpt-5.5";
const fallbackModels = ["anthropic/claude-opus-4.7", "google/gemini-3-flash"] as const;

const schema = z.object({
  discovery: z.object({
    context: z.string().nullable(),
    options: z.array(z.object({ feedback: z.string(), isCorrect: z.boolean(), text: z.string() })),
    question: z.string().nullable(),
  }),
  exampleTranslations: z.array(z.string()),
  exerciseFeedback: z.array(z.string()),
  exerciseQuestions: z.array(z.string().nullable()),
  exerciseTranslations: z.array(z.string()),
  ruleName: z.string(),
  ruleSummary: z.string(),
});

export type LessonGrammarUserContentSchema = z.infer<typeof schema>;

export type LessonGrammarUserContentParams = {
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
 * Generates USER_LANGUAGE content for a grammar lesson.
 *
 * The grammar content task produces TARGET_LANGUAGE examples and exercises.
 * This task takes that output as read-only context and generates all
 * USER_LANGUAGE content: translations, discovery question, rule summary,
 * and exercise feedback. Splitting generation this way keeps each AI call
 * focused on one language, which reduces language mixing errors.
 */
export async function generateLessonGrammarUserContent({
  chapterTitle,
  examples,
  exercises,
  lessonDescription,
  lessonTitle,
  model = defaultModel,
  reasoningEffort,
  targetLanguage,
  useFallback = true,
  userLanguage,
}: LessonGrammarUserContentParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `
    TARGET_LANGUAGE: ${promptContext.targetLanguageName}
    USER_LANGUAGE: ${promptContext.userLanguageName}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    EXAMPLES: ${JSON.stringify(examples, null, 2)}
    EXERCISES: ${JSON.stringify(exercises, null, 2)}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
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
