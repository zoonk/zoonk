import "server-only";
import { type LanguagePair } from "./_utils/level-test-bank";
import { loadLevelTestContext } from "./_utils/level-test-state";

export type LanguageLevelTestPreparation =
  | {
      /** The learner the questions are written for first, for analytics; the bank is shared. */
      learnerId: string;
      pair: LanguagePair;
      status: "preparing" | "ready";
    }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

/**
 * Whether one of the learner's language goals can take its level test now, or the pair's
 * questions still need writing (`preparing`, with the pair a workflow writes them for). The
 * level test's fallback when nothing started that workflow: only the learner's own tap asks.
 */
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
