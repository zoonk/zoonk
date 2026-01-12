import { getWritable } from "workflow";

import type { CourseGenerationEvent } from "./types";

export async function streamStatus(
  event: CourseGenerationEvent,
): Promise<void> {
  "use step";
  const writable = getWritable();
  const writer = writable.getWriter();
  await writer.write(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
  writer.releaseLock();
}
