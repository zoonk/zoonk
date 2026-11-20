import { type DayListStep } from "@/components/public/day-list";

type DayRow = Omit<DayListStep, "id" | "state">;

const CURRENT_STEP = 2;

function exampleStepState(index: number): DayListStep["state"] {
  if (index < CURRENT_STEP) {
    return "done";
  }

  return index === CURRENT_STEP ? "current" : "ahead";
}

export function toExampleSteps(rows: readonly DayRow[]): DayListStep[] {
  return rows.map((row, index) => ({ ...row, id: row.title, state: exampleStepState(index) }));
}
