import "server-only";
import { type Goal } from "@zoonk/db";
import { getAllowance } from "../../../entitlements/get-allowance";

export type AnytimeMockAccess = "open" | "plusRequired";

export async function getAnytimeMockAccess(goal: Pick<Goal, "kind">): Promise<AnytimeMockAccess> {
  const allowance = await getAllowance();

  return goal.kind === "exam" && allowance?.examPrep.includesMockExams === false
    ? "plusRequired"
    : "open";
}
