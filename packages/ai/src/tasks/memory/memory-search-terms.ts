import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./memory-search-terms.prompt.md";

/**
 * Runs before a task that may be waiting, and Flash Lite answers in about 1 s. On 10 cases (8 Nov
 * 2026) it, Luna, Haiku 5.5 and Gemini 3.8 Flash each found 8, all missing the same two facts whose
 * words none guessed: a recall limit of the prompt, not of the model.
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["openai/gpt-6-luna"] as const;

const schema = z.object({ terms: z.array(z.string()) });

export type MemorySearchTermsSchema = z.infer<typeof schema>;

export type MemorySearchTermsParams = {
  language: string;
  need: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** Favors recall: the relevance check drops what only shares a word. */
export async function generateMemorySearchTerms({
  analytics,
  language,
  model = defaultModel,
  need,
  reasoning,
  useFallback = true,
}: MemorySearchTermsParams) {
  const userPrompt = [
    `LANGUAGE: ${getPromptLanguageName({ language })}`,
    formatUntrustedInput({ NEED: need }),
  ].join("\n");

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
    task: "memory-search-terms",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
