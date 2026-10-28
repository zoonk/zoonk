import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./answer-from-material.prompt.md";

/**
 * Luna and Flash Lite both scored 10.0 on the answer-from-material eval; Luna is cheaper (27 Sep
 * 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite", "anthropic/claude-haiku-5.5"] as const;

const schema = z.object({ answer: z.string(), found: z.boolean(), refs: z.array(z.string()) });

export type MaterialAnswer = z.infer<typeof schema>;

export type AnswerFromMaterialInput = { language: string; material: string; question: string };

export type AnswerFromMaterialParams = AnswerFromMaterialInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

/** Says when the material doesn't cover a question instead of answering from general knowledge. */
export async function answerFromMaterial({
  analytics,
  language,
  material,
  model = defaultModel,
  question,
  reasoning,
  useFallback = true,
}: AnswerFromMaterialParams) {
  const userPrompt = `LANGUAGE: ${getPromptLanguageName({ language })}

${formatUntrustedInput({ MATERIAL: material, QUESTION: question })}`;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "answer-from-material",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
