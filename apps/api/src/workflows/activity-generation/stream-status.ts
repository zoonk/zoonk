import { streamError as sharedStreamError } from "@/workflows/_shared/stream-error";
import {
  type StepStatus,
  type WorkflowErrorReason,
  streamStatus as sharedStreamStatus,
} from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";

export async function streamStatus(params: {
  reason?: WorkflowErrorReason;
  step: ActivityStepName;
  status: StepStatus;
}) {
  "use step";
  return sharedStreamStatus(params);
}

export async function streamError(params: {
  reason: WorkflowErrorReason;
  step: ActivityStepName;
}): Promise<void> {
  "use step";
  return sharedStreamError(params);
}
