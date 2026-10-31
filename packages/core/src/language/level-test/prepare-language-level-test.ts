import "server-only";
import { type LanguagePair } from "./_utils/level-test-bank";
import { loadLevelTestContext } from "./_utils/level-test-state";

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

  return { learnerId: userId, pair, status: context.bank ? "ready" : "preparing" };
}
