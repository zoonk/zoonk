import { type ContentAnalytics } from "@/workflows/_shared/content-analytics";
import { startOnce } from "@/workflows/_shared/run-token";
import {
  type ListeningSetsInput,
  getListeningSetsToken,
  listeningSetsWorkflow,
} from "@/workflows/listening/listening-sets-workflow";

/**
 * Callable from routes, steps and workflows alike, so it imports nothing but workflow code:
 * workflow code can't load core, ai or the database.
 */
export async function startListeningSets(
  input: ListeningSetsInput & { analytics?: ContentAnalytics },
): Promise<{ generationId: string }> {
  const generationId = await startOnce(
    listeningSetsWorkflow,
    [input],
    getListeningSetsToken(input.goalId),
  );

  return { generationId };
}
