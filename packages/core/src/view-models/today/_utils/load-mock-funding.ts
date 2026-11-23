import "server-only";
import { type Goal } from "@zoonk/db";
import { readSavedPlan } from "../../../learner/facts/saved-plan";
import { findMockFundingOn } from "../../../plans/planner/mock-funding";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../../plans/planner/plan-state";
import { type SelectedDayPlan } from "../../../sessions/_utils/selected-day-plan";

/** Internal saved-ledger read, called only for an owned goal; previews provide their selected settings. */
export async function loadDayMockFunding({
  goal,
  localDate,
  selection,
}: {
  goal: Goal;
  localDate: Date;
  selection?: SelectedDayPlan | null;
}) {
  if (goal.kind !== "exam") {
    return null;
  }

  const plan = selection
    ? { items: selection.items, settings: selection.state.settings }
    : await readSavedPlan(goal.userId, goal.id);

  const funding = findMockFundingOn({
    date: localDate,
    funding: parsePlanSettings(plan?.settings).mockFunding,
  });

  if (!funding) {
    return null;
  }

  const mock = plan?.items.find(
    (item) =>
      item.kind === "mock" &&
      item.status === "todo" &&
      item.scheduledFor &&
      toIsoDate(item.scheduledFor) === funding.mockDate,
  );

  return { ...funding, ...(mock?.id && { planItemId: mock.id }) };
}
