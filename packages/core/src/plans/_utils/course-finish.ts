import { type FinishPrecision } from "../finish-contract";
import { daysBetween, fromIsoDate } from "../planner/plan-calendar";
import { type PlanPhase } from "../planner/plan-state";
import { type ComputedPlan } from "./replan";
import { type SelectedSummary } from "./selected-summary-contract";

type Finish = SelectedSummary["forecast"]["finish"];

const MONTH_PRECISION_DAYS = 548;

export function getFinishPrecision({ date, today }: { date: Date; today: Date }): FinishPrecision {
  return daysBetween(today, date) <= MONTH_PRECISION_DAYS ? "month" : "year";
}

export function getCourseFinish(computed: Pick<ComputedPlan, "selected" | "state">): Finish | null {
  return computed.state.goal.targetDate === null ? computed.selected.forecast.finish : null;
}

export function getFinishDisplay(finish: Finish | null) {
  return {
    // Older saved forecasts have no precision and could report beyondHorizon after only three years.
    finishReason: finish?.date === null && finish.precision !== undefined ? finish.reason : null,
    precision: finish?.precision ?? null,
  };
}

export function getPhaseMilestoneDates({ phase, today }: { phase: PlanPhase; today: Date | null }) {
  const endDate = phase.later ? null : phase.endDate;

  return {
    endDate,
    precision: endDate && today ? getFinishPrecision({ date: fromIsoDate(endDate), today }) : null,
    startDate: phase.later ? null : phase.startDate,
  };
}
