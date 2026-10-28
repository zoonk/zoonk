import "server-only";
import { type UsagePeriod, getReachedCap } from "../../../entitlements/contract";
import { getAllowance } from "../../../entitlements/get-allowance";

export async function findMockQuestionsCap(): Promise<UsagePeriod | null> {
  const allowance = await getAllowance();

  if (!allowance) {
    return "total";
  }

  return getReachedCap({ allowance, kind: "mockQuestions" })?.period ?? null;
}
