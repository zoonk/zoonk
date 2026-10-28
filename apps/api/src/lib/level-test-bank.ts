import { type ContentAnalytics } from "@/workflows/v2/_shared/content-analytics";
import {
  type LevelTestBankInput,
  levelTestBankWorkflow,
} from "@/workflows/v2/language/level-test-bank-workflow";
import { start } from "workflow/api";

/** Callable from routes, steps and workflows alike. */
export async function startLevelTestBank({
  analytics,
  pair,
}: {
  analytics?: ContentAnalytics;
  pair: LevelTestBankInput["pair"];
}): Promise<{ generationId: string }> {
  const run = await start(levelTestBankWorkflow, [{ analytics, pair }]);
  return { generationId: run.runId };
}
