import { createStepStream } from "./stream-status";

/**
 * Streams a "completed" status for a step that was skipped because its
 * output already existed or conditions made it unnecessary.
 *
 * This is a proper `"use step"` function so it can be called from workflow
 * context — where direct stream I/O is not allowed.
 */
export async function streamSkipStep<T extends string>(step: T): Promise<void> {
  "use step";

  await using stream = createStepStream<T>();
  await stream.status({ status: "completed", step });
}
