import "server-only";
import { type LanguagePair, loadLevelTestBank } from "./_utils/level-test-bank";
import { loadLevelTestContext } from "./_utils/level-test-state";
import { readLevelTestSummary } from "./read-level-test-summary";

export type LanguageLevelTestPreparation =
  | { learnerId: string; pair: LanguagePair; status: "preparing" | "ready" }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

export async function prepareLanguageLevelTest(
  goalId: string,
): Promise<LanguageLevelTestPreparation> {
  const context = await loadLevelTestContext(goalId);

  if (context.status !== "ready") {
    return context;
  }

  const { goal, userId } = context.owned;
  const pair = { language: goal.language, targetLanguage: goal.targetLanguage };

  const { attempt } = readLevelTestSummary(goal);
  const state = attempt ? await loadLevelTestBank(pair, true) : null;

  return {
    learnerId: userId,
    pair,
    status: state?.status ?? (context.bank ? "ready" : "preparing"),
  };
}
