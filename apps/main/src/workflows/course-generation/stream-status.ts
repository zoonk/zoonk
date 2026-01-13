import { getWritable } from "workflow";
import type { StepName, StepStatus, StreamMessage } from "./types";

export async function streamStatus(params: {
  step: StepName;
  status: StepStatus;
}) {
  const writable = getWritable<StreamMessage>();
  const writer = writable.getWriter();

  try {
    await writer.write(params);
  } finally {
    writer.releaseLock();
  }
}
