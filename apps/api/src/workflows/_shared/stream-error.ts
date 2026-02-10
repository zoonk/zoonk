import { sendErrorEmail } from "@zoonk/error-reporter/server";
import { type WorkflowErrorReason, streamStatus } from "./stream-status";

export async function streamError<T extends string>(params: {
  reason: WorkflowErrorReason;
  step: T;
}): Promise<void> {
  "use step";

  console.error("[Workflow Error]", JSON.stringify(params));

  await streamStatus({
    reason: params.reason,
    status: "error",
    step: params.step,
  });

  await sendErrorEmail({
    message: `${params.step}: ${params.reason}`,
    name: "WorkflowStepError",
    routeType: "workflow",
    source: "server",
  });
}
