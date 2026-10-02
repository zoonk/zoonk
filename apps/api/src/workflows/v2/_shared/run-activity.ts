import { safeAsync } from "@zoonk/utils/error";
import { getRun } from "workflow/api";

async function readRunStatus(runId: string) {
  const run = getRun(runId);
  return (await run.exists) ? run.status : null;
}

/**
 * Whether a run that holds a database claim is still working. Hooks only protect runs that are
 * alive, so a claim left by a run that crashed or was cancelled would block its content forever;
 * a claim whose run is gone (or whose id was never a run, like seeded content) can be taken over.
 */
export async function isRunActive(runId: string): Promise<boolean> {
  const { data: status, error } = await safeAsync(() => readRunStatus(runId));

  if (error) {
    return false;
  }

  return status === "pending" || status === "running";
}
