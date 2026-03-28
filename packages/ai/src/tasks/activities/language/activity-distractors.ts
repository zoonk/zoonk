import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { type DistractorShape } from "@zoonk/utils/distractors";
import { getLanguageName } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-distractors.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_DISTRACTORS ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["google/gemini-3.1-flash-lite-preview", "anthropic/claude-sonnet-4.6"];

const schema = z.object({
  distractors: z.array(z.string()),
});

export type ActivityDistractorsSchema = z.infer<typeof schema>;

export type ActivityDistractorsParams = {
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
export async function generateActivityDistractors({
  input,
  language,
  shape,
  model = DEFAULT_MODEL,
  reasoningEffort,
  useFallback = true,
}: ActivityDistractorsParams) {
  const languageName = getLanguageName({ targetLanguage: language, userLanguage: "en" });

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    reasoningEffort,
    useFallback,
  });

  const userPrompt = `INPUT: ${input}
LANGUAGE: ${languageName} (${language})
SHAPE: ${shape}`;

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
