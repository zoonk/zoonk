import { describeStep } from "@zoonk/ai/task-provenance";
import { registerTelemetry } from "ai";
import { type ModelConfig } from "./models";
import { type ModelCall, toModelCall } from "./types";

const calls: ModelCall[] = [];

/**
 * A model call is billed once the model answers, even when the answer then fails its schema or a
 * task's checks, or the task retries it, so no saved output or score carries every call a run pays.
 */
export function meterModelCalls(): void {
  registerTelemetry({
    experimental_onDecisionModelCallEnd: ({ modelId, usage }) => {
      calls.push({
        modelId,
        usage: { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 },
      });
    },
    /** `modelId` is the response's, which through the gateway is the provider's own id. */
    onLanguageModelCallEnd: ({ modelId, provider, providerMetadata, usage }) => {
      const step = { model: { modelId, provider }, providerMetadata, response: { modelId }, usage };
      calls.push(toModelCall(describeStep(step)));
    },
  });
}

export function getMeteredCalls(): ModelCall[] {
  return [...calls];
}

/** Calls from anything that runs alongside `work` count as its own. */
export async function meterWork<T>(
  work: () => Promise<T>,
): Promise<{ calls: ModelCall[]; result: T }> {
  const start = calls.length;
  const result = await work();

  return { calls: calls.slice(start), result };
}

/** AI SDK telemetry doesn't see image or GPT-Live calls, so a run records the outputs they wrote. */
export function isPricedFromOutputs(kind: ModelConfig["kind"]): boolean {
  return kind === "image" || kind === "realtime";
}

export function recordCalls(newCalls: ModelCall[]): void {
  calls.push(...newCalls);
}
