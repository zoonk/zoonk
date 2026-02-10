import { streamError as sharedStreamError } from "@/workflows/_shared/stream-error";
import {
  type StepStatus,
  type WorkflowErrorReason,
  streamStatus as sharedStreamStatus,
} from "@/workflows/_shared/stream-status";
import { type ChapterStepName } from "@/workflows/config";

export async function streamStatus(params: {
  reason?: WorkflowErrorReason;
  step: ChapterStepName;
  status: StepStatus;
}) {
  "use step";
  return sharedStreamStatus(params);
}

export async function streamError(params: {
  reason: WorkflowErrorReason;
  step: ChapterStepName;
}): Promise<void> {
  "use step";
  return sharedStreamError(params);
}
