import "server-only";
import { getOwnedGoal } from "../../learner/get-owned-goal";
import { loadLevelTestContext, toLevelTestView } from "./_utils/level-test-state";
import { type LanguageLevelTestView } from "./level-test-contract";

export type LanguageLevelTestResult =
  | { status: "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; test: LanguageLevelTestView };

/** Read-only: returns `preparing` until a separately started workflow writes the questions. */
export async function getLanguageLevelTest(goalId: string): Promise<LanguageLevelTestResult> {
  const context = await loadLevelTestContext(goalId, await getOwnedGoal(goalId));

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
