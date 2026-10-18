import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./memory-search-terms.prompt.md";

/**
 * Runs before a task that may be waiting. In the memory-search-terms eval, Luna, Flash Lite and
 * Gemini 3.8 Flash found the same facts; Flash Lite answered three times faster than Luna.
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["openai/gpt-6-luna"] as const;

const schema = z.object({ terms: z.array(z.string()) });

export type MemorySearchTermsSchema = z.infer<typeof schema>;

export type MemorySearchTermsParams = {
  /** The learner's language, which their facts are written in. */
  language: string;
  /** What the task is about to do for the learner, such as "Examples for a lesson on discounts". */
  need: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * Writes the words that find a learner's facts for one task when their memory is too large to
 * read whole. It favors recall: the relevance check drops what only shares a word.
 */
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
