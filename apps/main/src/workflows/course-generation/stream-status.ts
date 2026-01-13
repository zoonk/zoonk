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
    // Write as JSON string with newline for NDJSON format
    const message: StreamMessage = params;
    await writer.write(`${JSON.stringify(message)}\n`);
  } finally {
    writer.releaseLock();
  }
}
