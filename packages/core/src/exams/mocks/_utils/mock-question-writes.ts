import "server-only";
import { type UsagePeriod, getReachedCap } from "../../../entitlements/contract";
import { getAllowance } from "../../../entitlements/get-allowance";

/**
 * What stops new questions being written for the learner's mocks now: their plan's fair use for it
 * (see `limits.ts`) used up for the day or the month (`total` without one). Null while it has
 * some left. Past it, a mock asks the questions the bank has instead of waiting for new ones.
 */
export async function findMockQuestionsCap(): Promise<UsagePeriod | null> {
  const allowance = await getAllowance();

  if (!allowance) {
    return "total";
  }

  return getReachedCap({ allowance, kind: "mockQuestions" })?.period ?? null;
}
