import "server-only";
import { type AllowanceLimit, getReachedCap } from "../../../entitlements/contract";
import { getAllowance } from "../../../entitlements/get-allowance";

export async function findMockQuestionsCap(): Promise<Pick<
  AllowanceLimit,
  "period" | "availableAt"
> | null> {
  const allowance = await getAllowance();

  if (!allowance) {
    return { period: "total" };
  }

  return getReachedCap({ allowance, kind: "mockQuestions" });
}
