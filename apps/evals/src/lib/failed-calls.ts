import { AsyncLocalStorage } from "node:async_hooks";
import { registerTelemetry } from "ai";
import { type ModelCall, toTokenUsage } from "./types";

const callsInWork = new AsyncLocalStorage<ModelCall[]>();
let failedCalls: ModelCall[] = [];

/**
 * A model call is billed once the model answers, even when the answer then fails its schema or the
 * task's checks. No saved output or score carries those calls, so a run's spend reads them here.
 */
export function trackFailedCalls(): void {
  registerTelemetry({
    onLanguageModelCallEnd: ({ modelId, usage }) => {
      callsInWork.getStore()?.push({ modelId, usage: toTokenUsage(usage) });
    },
  });
}

export async function keepCallsOnFailure<T>(work: () => Promise<T>): Promise<T> {
  const calls: ModelCall[] = [];

  try {
    return await callsInWork.run(calls, work);
  } catch (error) {
    failedCalls = [...failedCalls, ...calls];
    throw error;
  }
}

export function takeFailedCalls(): ModelCall[] {
  const calls = failedCalls;
  failedCalls = [];
  return calls;
}
