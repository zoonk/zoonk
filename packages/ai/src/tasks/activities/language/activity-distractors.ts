import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { type DistractorShape } from "@zoonk/utils/distractors";
import { getLanguageName } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-distractors.prompt.md";

const taskName = "activity-distractors";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

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
  model = defaultModel,
  reasoningEffort,
  useFallback = true,
}: ActivityDistractorsParams) {
  const languageName = getLanguageName({ targetLanguage: language, userLanguage: "en" });

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    taskName,
    useFallback,
  });

  const userPrompt = `
    INPUT: ${input}
    LANGUAGE: ${languageName} (${language})
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
