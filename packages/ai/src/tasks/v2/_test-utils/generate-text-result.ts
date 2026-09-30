import { type generateText } from "ai";

/** The parts of a `generateText` result a task reads: the output, the final step and usage. */
export function createGenerateTextResult(output: unknown, modelId = "openai/gpt-6-sol") {
  const finalStep = {
    model: { modelId, provider: "gateway" },
    providerMetadata: undefined,
    response: { modelId },
  };

  const usage = {
    inputTokenDetails: {},
    inputTokens: 1,
    outputTokenDetails: {},
    outputTokens: 1,
    totalTokens: 2,
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Tasks only read these fields; a full AI SDK result would bury what the test is about.
  return { finalStep, output, steps: [finalStep], usage } as unknown as Awaited<
    ReturnType<typeof generateText>
  >;
}
