import { type DayListStep } from "@/components/public/day-list";

type DayRow = Omit<DayListStep, "id" | "state">;

export function toExampleSteps(rows: readonly DayRow[]): DayListStep[] {
  return rows.map((row, index) => ({
    ...row,
    id: row.title,
    state: index === 0 ? "current" : "ahead",
  }));
}
