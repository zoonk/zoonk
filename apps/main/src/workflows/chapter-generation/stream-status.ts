import {
  type StepStatus,
  streamStatus as sharedStreamStatus,
} from "@/workflows/_shared/stream-status";
import type { ChapterStepName } from "@/workflows/config";

export async function streamStatus(params: {
  step: ChapterStepName;
  status: StepStatus;
}) {
  "use step";
  return sharedStreamStatus(params);
}
