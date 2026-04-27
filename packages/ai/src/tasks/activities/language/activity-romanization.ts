import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-romanization.prompt.md";

const taskName = "activity-romanization";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

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
  model = defaultModel,
  reasoningEffort,
  targetLanguage,
  texts,
  useFallback = true,
}: ActivityRomanizationParams) {
  const formattedTexts = texts.map((text, index) => `${index + 1}. ${text}`).join("\n");

  const userPrompt = `
    TARGET_LANGUAGE: ${targetLanguage}
    TEXTS: ${formattedTexts}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    taskName,
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
