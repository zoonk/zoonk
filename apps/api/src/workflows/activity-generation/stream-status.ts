import {
  type StepStatus,
  streamStatus as sharedStreamStatus,
} from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";

export async function streamStatus(params: { step: ActivityStepName; status: StepStatus }) {
  "use step";
  return sharedStreamStatus(params);
}
