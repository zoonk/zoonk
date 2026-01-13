import { getWritable } from "workflow";
import type { StepName, StepStatus, StreamMessage } from "./types";

export async function streamStatus(params: {
  step: StepName;
  status: StepStatus;
}) {
  "use step";

  const writable = getWritable<string>();
  const writer = writable.getWriter();

  try {
    // Write as SSE format for eventsource-parser consumption
    const message: StreamMessage = params;
    await writer.write(`data: ${JSON.stringify(message)}\n\n`);
  } finally {
    writer.releaseLock();
  }
}
