import { getWritable } from "workflow";

export type StepStatus = "started" | "completed" | "error";

export async function streamStatus<T extends string>(params: {
  step: T;
  status: StepStatus;
}) {
  "use step";

  const writable = getWritable<string>();
  const writer = writable.getWriter();

  try {
    // Write as SSE format for eventsource-parser consumption
    const message = params;
    await writer.write(`data: ${JSON.stringify(message)}\n\n`);
  } finally {
    writer.releaseLock();
  }
}
