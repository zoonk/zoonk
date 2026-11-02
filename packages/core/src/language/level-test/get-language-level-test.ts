import "server-only";
import { loadLevelTestContext, toLevelTestView } from "./_utils/level-test-state";
import { type LanguageLevelTestView } from "./level-test-contract";

export type LanguageLevelTestResult =
  | { status: "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; test: LanguageLevelTestView };

/**
 * Read-only: returns `preparing` until a separately started workflow writes the questions. Apps read
 * it again after each answer, which expires no cache tag, so it reads the goal fresh.
 */
export async function getLanguageLevelTest(goalId: string): Promise<LanguageLevelTestResult> {
  const context = await loadLevelTestContext(goalId);

  if (context.status !== "ready") {
    return context;
  }

  return {
    status: "ready",
    test: await toLevelTestView({
      bank: context.bank,
      bankStartedAt: context.bankStartedAt,
      bankWrittenAt: context.bankWrittenAt,
      goal: context.owned.goal,
      progress: context.progress,
    }),
  };
}
