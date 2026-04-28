import { type StepStreamMessage, type WorkflowErrorReason } from "@zoonk/core/workflows/steps";
import { logError } from "@zoonk/utils/logger";
import { getWritable } from "workflow";

export function getAIResultErrorReason({
  error,
  result,
}: {
  error?: Error | null;
  result?: unknown;
} = {}): WorkflowErrorReason {
  if (error) {
    return "aiGenerationFailed";
  }

  if (!result) {
    return "aiEmptyResult";
  }

  return "contentValidationFailed";
}

type StepStream<T extends string> = {
  status: (params: StepStreamMessage<T>) => Promise<void>;
  error: (params: { reason: WorkflowErrorReason; step: T }) => Promise<void>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

/** Writes an SSE event to the workflow stream. */
async function writeSSE(
  writer: WritableStreamDefaultWriter<string>,
  data: Record<string, unknown>,
): Promise<void> {
  await writer.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Creates a stream writer for emitting SSE status events from within a step.
 * Use this for batch/shared steps that process all lessons at once.
 *
 * Acquires the workflow stream writer once. The lock is released automatically
 * when the enclosing scope exits via `await using` — on return, throw, or
 * early return.
 *
 * Usage:
 * ```ts
 * async function myBatchStep() {
 *   "use step";
 *   await using stream = createStepStream<MyStepName>();
 *   await stream.status({ step: "myStep", status: "started" });
 *   // ... do work ...
 *   await stream.status({ step: "myStep", status: "completed" });
 *   // writer.releaseLock() called automatically here
 * }
 * ```
 */
export function createStepStream<T extends string>(): StepStream<T> {
  const writer = getWritable<string>().getWriter();

  return {
    async [Symbol.asyncDispose]() {
      writer.releaseLock();
    },

    async error(params: { reason: WorkflowErrorReason; step: T }) {
      logError("[Workflow Error]", JSON.stringify(params));
      await writeSSE(writer, { ...params, status: "error" });
    },

    async status(params: StepStreamMessage<T>) {
      await writeSSE(writer, params);
    },
  };
}
