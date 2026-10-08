import "server-only";
import { loadLevelTestContext, toLevelTestView } from "./_utils/level-test-state";
import { type LanguageLevelTestView } from "./level-test-contract";

export type LanguageLevelTestResult =
  | { status: "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; test: LanguageLevelTestView };

/**
 * The three-minute level test of a language goal: the next reading or listening question near the
 * learner's level, then one sentence to say out loud, and the levels so far. While the pair's
 * questions are written, it says since when (null when nothing is writing them, so the app starts
 * their workflow) and how long it usually takes, and the app asks again. Read-only.
 */
export async function getLanguageLevelTest(goalId: string): Promise<LanguageLevelTestResult> {
  const context = await loadLevelTestContext(goalId);

  if (context.status !== "ready") {
    return context;
  }

  return {
    status: "ready",
    test: toLevelTestView({
      bank: context.bank,
      bankStartedAt: context.bankStartedAt,
      goal: context.owned.goal,
      progress: context.progress,
    }),
  };
}
