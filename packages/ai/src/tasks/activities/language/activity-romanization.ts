import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-romanization.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const schema = z.object({
  romanizations: z.array(z.string()),
});

export type ActivityRomanizationSchema = z.infer<typeof schema>;

export type ActivityRomanizationParams = {
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  texts: string[];
  useFallback?: boolean;
};

/**
 * Converts non-Roman script texts into their Roman letter representations
 * using standard romanization systems (e.g., Romaji for Japanese, Pinyin for Chinese).
 * This is used to help learners read and pronounce text written in unfamiliar scripts.
 */
export async function generateActivityRomanization({
  model = DEFAULT_MODEL,
  reasoningEffort,
  targetLanguage,
  texts,
  useFallback = true,
}: ActivityRomanizationParams) {
  const formattedTexts = texts.map((text, index) => `${index + 1}. ${text}`).join("\n");

  const userPrompt = `TARGET_LANGUAGE: ${targetLanguage}

TEXTS:
${formattedTexts}

Romanize each text using the standard romanization system for the target language. Return one romanization per text in the same order.`;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    model,
    reasoningEffort,
    taskName: "activity-romanization",
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
