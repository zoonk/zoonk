import { isRunActive } from "./run-activity";

export async function isRunActiveStep(runId: string): Promise<boolean> {
  "use step";

  return isRunActive(runId);
}
