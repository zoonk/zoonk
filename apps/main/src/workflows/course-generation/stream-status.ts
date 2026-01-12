import { getWritable } from "workflow";

import type { CourseGenerationEvent } from "./types";

/**
 * Streams a status event to the client.
 * IMPORTANT: This must be called from within a step context (a function with "use step").
 * See https://useworkflow.dev/docs/foundations/streaming
 */
export async function streamStatus(
  options: Omit<CourseGenerationEvent, "timestamp">,
): Promise<void> {
  const event: CourseGenerationEvent = { ...options, timestamp: Date.now() };

  const writable = getWritable();
  const writer = writable.getWriter();
  await writer.write(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
  writer.releaseLock();
}
