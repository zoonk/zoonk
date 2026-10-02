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
 * From the answer-from-material eval (5 questions in Portuguese and English, code scoring, 27 Sep
 * 2026): Luna and Gemini 3.5 Flash Lite both scored 10.0, answering from the right slide and
 * saying when the material doesn't cover a question; Luna is the cheaper at $0.12 per 1,000.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite", "anthropic/claude-haiku-4.5"] as const;

const schema = z.object({ answer: z.string(), found: z.boolean(), refs: z.array(z.string()) });

export type MaterialAnswer = z.infer<typeof schema>;

export type AnswerFromMaterialInput = {
  language: string;
  /** The pages most related to the question, tagged with their references. */
  material: string;
  question: string;
};

export type AnswerFromMaterialParams = AnswerFromMaterialInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

/**
 * Answers a learner's question about their own class material from its pages, with the pages it
 * used, or says the material doesn't cover it instead of answering from general knowledge.
 */
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
