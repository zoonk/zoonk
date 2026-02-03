import {
  type StepStatus,
  streamStatus as sharedStreamStatus,
} from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@/workflows/config";

export async function streamStatus(params: { step: LessonStepName; status: StepStatus }) {
  "use step";
  return sharedStreamStatus(params);
}
