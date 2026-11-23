import { startOnce } from "@/workflows/_shared/run-token";
import {
  type LevelTestBankInput,
  getLevelTestBankToken,
  levelTestBankWorkflow,
} from "@/workflows/language/level-test-bank-workflow";

/** Callable from routes, steps and workflows alike. */
export async function startLevelTestBank(
  input: LevelTestBankInput,
): Promise<{ generationId: string }> {
  const generationId = await startOnce(
    levelTestBankWorkflow,
    [input],
    getLevelTestBankToken(input.pair),
  );

  return { generationId };
}
