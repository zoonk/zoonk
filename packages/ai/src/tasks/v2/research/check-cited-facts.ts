import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./check-cited-facts.prompt.md";

/** The `check-cited-facts` eval: Flash judged every planted fact right; Haiku accepted an unsupported one. */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-luna"] as const;

const schema = z.object({ results: z.array(z.object({ id: z.string(), supported: z.boolean() })) });

/** One extracted fact in words, with the passage it quotes. */
export type CitedFact = { id: string; passage: string; statement: string };

export type CheckCitedFactsParams = {
  facts: CitedFact[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatFacts(facts: CitedFact[]): string {
  return JSON.stringify(
    facts.map((fact) => ({ fact: fact.statement, id: fact.id, passage: fact.passage })),
    null,
    2,
  );
}

/**
 * Checks that each fact says no more than its passage, the second half of the
 * rule that every blueprint field is traced to its source (code first checks
 * that the passage is really in the document). A fact the model skipped
 * counts as unsupported.
 */
export async function checkCitedFacts({
  analytics,
  facts,
  model = defaultModel,
  reasoning,
  useFallback = true,
}: CheckCitedFactsParams) {
  const userPrompt = formatUntrustedInput({ FACTS: formatFacts(facts) });
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
        temperature: 0,
      }),
    systemPrompt,
    task: "check-cited-facts",
  });

  const supported = new Set(
    result.output.results.filter((item) => item.supported).map((item) => item.id),
  );

  return {
    data: { supportedIds: facts.map((fact) => fact.id).filter((id) => supported.has(id)) },
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
