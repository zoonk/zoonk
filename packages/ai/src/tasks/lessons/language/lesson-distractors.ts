import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { type DistractorShape } from "@zoonk/utils/distractors";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./lesson-distractors.prompt.md";

const defaultModel = "openai/gpt-5.4";
const fallbackModels = ["google/gemini-3.1-flash-lite", "anthropic/claude-sonnet-4.6"] as const;

const schema = z.object({ distractors: z.array(z.string().min(1)).min(1) });

export type LessonDistractorsSchema = z.infer<typeof schema>;

export type LessonDistractorsParams = {
  input: string;
  language: string;
  shape: DistractorShape;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  useFallback?: boolean;
};

/**
 * Generates direct distractor words for a word or sentence in one language.
 *
 * The caller decides which source text to pass:
 * - target-language word for translation distractors
 * - target-language sentence for reading distractors
 * - user-language sentence translation for listening distractors
 *
 * This task intentionally receives only the surface text and language. Quality is
 * enforced by a strict prompt plus eval coverage instead of runtime semantic logic.
 */
export async function generateLessonDistractors({
  input,
  language,
  shape,
  model = defaultModel,
  reasoningEffort,
  useFallback = true,
}: LessonDistractorsParams) {
  const languageName = getPromptLanguageName({ language });

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    useFallback,
  });

  const userPrompt = `
    INPUT: ${input}
    LANGUAGE: ${languageName}
    SHAPE: ${shape}
  `;

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
