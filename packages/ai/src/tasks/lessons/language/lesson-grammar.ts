import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./lesson-grammar.prompt.md";

const defaultModel = "openai/gpt-5.6-sol";
const fallbackModels = ["anthropic/claude-opus-4.8", "google/gemini-3.5-flash"] as const;

const explanationSchema = z.object({ text: z.string(), title: z.string() });

const exampleSchema = z.object({
  highlight: z.string(),
  sentence: z.string(),
  translation: z.string(),
});

const questionSchema = z.object({
  answer: z.string(),
  distractors: z.array(z.string()),
  feedback: z.string(),
  question: z.string().nullable(),
  template: z.string(),
});

const schema = z.object({
  examples: z.array(exampleSchema).min(1),
  explanations: z.array(explanationSchema).min(1),
  questions: z.array(questionSchema).min(1),
});

export type LessonGrammarSchema = z.infer<typeof schema>;

export type LessonGrammarParams = {
  chapterTitle: string;
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  reasoning?: Reasoning;
  targetLanguage: string;
  useFallback?: boolean;
  userLanguage: string;
};

/**
 * Generates the full grammar lesson content in one pass.
 *
 * Grammar lessons need the explanation, examples, and fill-in-the-blank
 * questions to teach the same exact rule. Keeping that structure in one AI
 * task prevents index-matching drift between separate target-language and
 * user-language generations.
 */
export async function generateLessonGrammar({
  chapterTitle,
  lessonDescription,
  lessonTitle,
  model = defaultModel,
  reasoning,
  targetLanguage,
  useFallback = true,
  userLanguage,
}: LessonGrammarParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `
    TARGET_LANGUAGE: ${promptContext.targetLanguageName}
    USER_LANGUAGE: ${promptContext.userLanguageName}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
