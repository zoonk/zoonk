import { type ContentAnalytics } from "@/workflows/_shared/content-analytics";
import { startOnce } from "@/workflows/_shared/run-token";
import {
  type LevelTestBankInput,
  getLevelTestBankToken,
  levelTestBankWorkflow,
} from "@/workflows/language/level-test-bank-workflow";

/** Callable from routes, steps and workflows alike. */
export async function startLevelTestBank({
  analytics,
  pair,
}: {
  analytics?: ContentAnalytics;
  pair: LevelTestBankInput["pair"];
}): Promise<{ generationId: string }> {
  const generationId = await startOnce(
    levelTestBankWorkflow,
    [{ analytics, pair }],
    getLevelTestBankToken(pair),
  );

  return { generationId };
}
