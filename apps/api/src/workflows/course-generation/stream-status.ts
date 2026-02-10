import { streamError as sharedStreamError } from "@/workflows/_shared/stream-error";
import {
  type StepStatus,
  type WorkflowErrorReason,
  streamStatus as sharedStreamStatus,
} from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@/workflows/config";

export async function streamStatus(params: {
  reason?: WorkflowErrorReason;
  step: CourseWorkflowStepName;
  status: StepStatus;
}) {
  "use step";
  return sharedStreamStatus(params);
}

export async function streamError(params: {
  reason: WorkflowErrorReason;
  step: CourseWorkflowStepName;
}): Promise<void> {
  "use step";
  return sharedStreamError(params);
}
