import {
  type StepStatus,
  streamStatus as sharedStreamStatus,
} from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@/workflows/config";

export async function streamStatus(params: { step: CourseWorkflowStepName; status: StepStatus }) {
  "use step";
  return sharedStreamStatus(params);
}
