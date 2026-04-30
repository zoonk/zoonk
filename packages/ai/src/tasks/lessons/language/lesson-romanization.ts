import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./lesson-romanization.prompt.md";

const taskName = "lesson-romanization";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const romanizationSchema = z.string().min(1);

/**
 * Builds a schema that requires one romanization per requested text. The
 * expected count is only known at call time, so this keeps the reusable type
 * and the runtime validation tied to the same schema shape.
 */
function buildSchema(textCount: number) {
  return z.object({
    romanizations: z.array(romanizationSchema).length(textCount),
  });
}

export type LessonRomanizationSchema = z.infer<ReturnType<typeof buildSchema>>;

export type LessonRomanizationParams = {
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
export async function generateLessonRomanization({
  model = defaultModel,
  reasoningEffort,
  targetLanguage,
  texts,
  useFallback = true,
}: LessonRomanizationParams) {
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
    output: Output.object({ schema: buildSchema(texts.length) }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
