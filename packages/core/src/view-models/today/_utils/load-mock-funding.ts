import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { findMockFundingOn } from "../../../plans/planner/mock-funding";
import { parsePlanSettings } from "../../../plans/planner/plan-state";

/** Internal saved-ledger read, called for an owned goal only after the day resolver refreshed it. */
export async function loadDayMockFunding({ goal, localDate }: { goal: Goal; localDate: Date }) {
  if (goal.kind !== "exam") {
    return null;
  }

  const plan = await prisma.plan.findUnique({
    select: { settings: true },
    where: { goalId: goal.id },
  });

  return plan
    ? findMockFundingOn({ date: localDate, funding: parsePlanSettings(plan.settings).mockFunding })
    : null;
}
