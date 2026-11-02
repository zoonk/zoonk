import "server-only";
import { type Goal } from "@zoonk/db";
import { readSavedPlan } from "../../../learner/facts/saved-plan";
import { findMockFundingOn } from "../../../plans/planner/mock-funding";
import { parsePlanSettings } from "../../../plans/planner/plan-state";

/** Internal saved-ledger read, called only for an owned goal; previews provide their selected settings. */
export async function loadDayMockFunding({
  goal,
  localDate,
  selectedSettings,
}: {
  goal: Goal;
  localDate: Date;
  selectedSettings?: unknown;
}) {
  if (goal.kind !== "exam") {
    return null;
  }

  if (selectedSettings !== undefined) {
    return findMockFundingOn({
      date: localDate,
      funding: parsePlanSettings(selectedSettings).mockFunding,
    });
  }

  const plan = await readSavedPlan(goal.userId, goal.id);

  return plan
    ? findMockFundingOn({ date: localDate, funding: parsePlanSettings(plan.settings).mockFunding })
    : null;
}
