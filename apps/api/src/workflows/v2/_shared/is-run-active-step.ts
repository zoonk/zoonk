import { isRunActive } from "./run-activity";

/** Whether another run is still working, for workflows that wait on it with durable sleeps. */
export async function isRunActiveStep(runId: string): Promise<boolean> {
  "use step";

  return isRunActive(runId);
}
