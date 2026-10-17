import { type ContentAnalytics } from "@/workflows/v2/_shared/content-analytics";
import {
  type LevelTestBankInput,
  levelTestBankWorkflow,
} from "@/workflows/v2/language/level-test-bank-workflow";
import { start } from "workflow/api";

/**
 * Starts writing a language pair's level test in a workflow, as early as the pair is known: when
 * onboarding understands a language goal, when the goal's curriculum starts, or from the level
 * test when nothing is writing it. A run already writing the pair is joined, and a pair already
 * written ends at once. Returns the run, which streams `writeLevelTestBank` then
 * `levelTestBankReady`. Callable from routes, steps and workflows alike.
 */
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
