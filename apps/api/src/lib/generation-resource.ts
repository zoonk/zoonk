import "server-only";
import { type Run } from "workflow/api";

/**
 * Serializes Workflow's internal run handle into the small public generation
 * resource shared by create and get operations.
 */
export async function toGenerationResource(run: Run<unknown>) {
  return { id: run.runId, status: await run.status };
}
