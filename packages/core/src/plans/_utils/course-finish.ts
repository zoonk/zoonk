import { type FinishPrecision } from "../finish-contract";
import { daysBetween, fromIsoDate } from "../planner/plan-calendar";
import { type PlanPhase } from "../planner/plan-state";
import { type PlanSummary } from "./plan-summary";
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

export function getDatedFinish({ date, today }: { date: string; today: Date }): Finish {
  return { date, precision: getFinishPrecision({ date: fromIsoDate(date), today }) };
}

export function getSavedCourseFinish(summary: PlanSummary): Finish {
  const { finish } = summary.selected.forecast;

  return finish.date && !finish.precision
    ? getDatedFinish({ date: finish.date, today: fromIsoDate(summary.basis.layoutStudyDay) })
    : finish;
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
