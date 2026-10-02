import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import { getWritable } from "workflow";

type StepStream<T extends string> = {
  status: (params: StepStreamMessage<T>) => Promise<void>;
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
 *
 * Acquires the workflow stream writer once. The lock is released automatically
 * when the enclosing scope exits via `await using` — on return, throw, or
 * early return.
 *
 * Usage:
 * ```ts
 * async function myStep() {
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

    async status(params: StepStreamMessage<T>) {
      await writeSSE(writer, params);
    },
  };
}
