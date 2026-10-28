import { type ContentAnalytics } from "@/workflows/v2/_shared/content-analytics";
import {
  type ListeningSetsInput,
  listeningSetsWorkflow,
} from "@/workflows/v2/listening/listening-sets-workflow";
import { start } from "workflow/api";

/**
 * Callable from routes, steps and workflows alike, so it imports nothing but the workflow:
 * workflow code can't load core, ai or the database.
 */
export async function startListeningSets(
  input: ListeningSetsInput & { analytics?: ContentAnalytics },
): Promise<{ generationId: string }> {
  const run = await start(listeningSetsWorkflow, [input]);
  return { generationId: run.runId };
}
