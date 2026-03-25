import { logError } from "@zoonk/utils/logger";
import { getWritable } from "workflow";

export type StepStatus = "started" | "completed" | "error";

export type WorkflowErrorReason =
  | "aiEmptyResult"
  | "aiGenerationFailed"
  | "contentValidationFailed"
  | "dbFetchFailed"
  | "dbSaveFailed"
  | "enrichmentFailed"
  | "noSourceData"
  | "notFound";

export function getAIResultErrorReason(
  error: Error | null | undefined,
  result: unknown,
): WorkflowErrorReason {
  if (error) {
    return "aiGenerationFailed";
  }

  if (!result) {
    return "aiEmptyResult";
  }

  return "contentValidationFailed";
}

export type StepStream<T extends string> = {
  status: (params: { step: T; status: StepStatus; reason?: WorkflowErrorReason }) => Promise<void>;
  error: (params: { reason: WorkflowErrorReason; step: T }) => Promise<void>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates a stream writer for emitting SSE status events from within a step.
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

    async error(params: { reason: WorkflowErrorReason; step: T }) {
      logError("[Workflow Error]", JSON.stringify(params));
      await writer.write(`data: ${JSON.stringify({ ...params, status: "error" })}\n\n`);
    },

    async status(params: { step: T; status: StepStatus; reason?: WorkflowErrorReason }) {
      await writer.write(`data: ${JSON.stringify(params)}\n\n`);
    },
  };
}
