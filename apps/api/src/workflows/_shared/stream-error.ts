import { logError } from "@zoonk/utils/logger";
import { type WorkflowErrorReason, streamStatus } from "./stream-status";

export async function streamError<T extends string>(params: {
  reason: WorkflowErrorReason;
  step: T;
}): Promise<void> {
  "use step";

  logError("[Workflow Error]", JSON.stringify(params));

  await streamStatus({
    reason: params.reason,
    status: "error",
    step: params.step,
  });
}
