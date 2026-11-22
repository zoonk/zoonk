import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { Output, generateText } from "ai";
import z from "zod";
import { getCallCost } from "./cost";
import keyFlawsPrompt from "./key-flaws-prompt.md";
import { keyFlawSchema, toTokenUsage } from "./types";

export function keyFlawsFor(locators: string[] | undefined) {
  return locators?.length
    ? z.array(keyFlawSchema.extend({ itemLocator: z.enum(locators) }))
    : z.array(keyFlawSchema).length(0);
}
export async function solveAnswerKeys({
  locators,
  output,
  prompt,
}: {
  locators: string[];
  output: string;
  prompt: string;
}) {
  const modelId = "openai/gpt-6.2-astra";

  const result = await generateText({
    instructions: keyFlawsPrompt,
    model: modelId,
    output: Output.object({ schema: z.object({ keyFlaws: keyFlawsFor(locators) }) }),
    prompt: JSON.stringify({ input: prompt, result: output }),
  });

  const { keyFlaws } = result.output;

  if (new Set(keyFlaws.map((flaw) => flaw.itemLocator)).size !== keyFlaws.length) {
    throw new Error("Duplicate answer-key finding.");
  }

  return {
    costUsd: getCallCost({ modelId, prices: GATEWAY_PRICES, usage: toTokenUsage(result.usage) }),
    keyFlaws,
  };
}
