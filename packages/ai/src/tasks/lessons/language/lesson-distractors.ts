import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { type DistractorShape } from "@zoonk/utils/distractors";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./lesson-distractors.prompt.md";

const defaultModel = "openai/gpt-5.6-sol";
const fallbackModels = ["google/gemini-3.1-flash-lite", "anthropic/claude-sonnet-4.6"] as const;

const schema = z.object({ distractors: z.array(z.string().min(1)).min(1) });

export type LessonDistractorsSchema = z.infer<typeof schema>;

export type LessonDistractorTranslation = { language: string; text: string };

export type LessonDistractorsParams = {
  input: string;
  language: string;
  shape: DistractorShape;
  translation?: LessonDistractorTranslation;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

/**
 * Adds the known learner-language translation when vocabulary generation has
 * it. Translation options are unfair when a wrong option could also answer the
 * same visible prompt, so the distractor prompt needs that prompt text instead
 * of guessing from the target-language word alone.
 */
function getTranslationPromptLines(params: { translation?: LessonDistractorTranslation }) {
  if (!params.translation) {
    return [];
  }

  const translationLanguage = getPromptLanguageName({ language: params.translation.language });

  return [
    `TRANSLATION: ${params.translation.text}`,
    `TRANSLATION_LANGUAGE: ${translationLanguage}`,
  ];
}

/**
 * Generates direct distractor words for a word or sentence in one language.
 *
 * The caller decides which source text to pass:
 * - target-language word for translation distractors
 * - target-language sentence for reading distractors
 * - user-language sentence translation for listening distractors
 *
 * Translation-answer distractors may also include the known learner-language
 * translation so the model can avoid wrong options that are actually valid
 * answers to the same visible prompt.
 */
export async function generateLessonDistractors({
  input,
  language,
  shape,
  translation,
  model = defaultModel,
  reasoning,
  useFallback = true,
}: LessonDistractorsParams) {
  const languageName = getPromptLanguageName({ language });

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const userPrompt = [
    `INPUT: ${input}`,
    `LANGUAGE: ${languageName}`,
    ...getTranslationPromptLines({ translation }),
    `SHAPE: ${shape}`,
  ].join("\n");

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
