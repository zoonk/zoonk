import {
  type StepStatus,
  streamStatus as sharedStreamStatus,
} from "@/workflows/_shared/stream-status";
import type { StepName } from "./types";

export async function streamStatus(params: {
  step: StepName;
  status: StepStatus;
}) {
  "use step";
  return sharedStreamStatus(params);
}
