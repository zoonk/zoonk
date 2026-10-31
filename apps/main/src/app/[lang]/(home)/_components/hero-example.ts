import { type DayListStep } from "@/components/public/day-list";

type HeroStep = DayListStep & { topic: string };

export type HeroExample = {
  file: string;
  label: string;
  moreTabs: number;
  name: string;
  search: string;
  steps: readonly HeroStep[];
  suggestions: readonly [string, string];
  tabs: readonly [string, string];
  topics: readonly string[];
};

type DayRow = Omit<HeroStep, "id" | "state">;

export function toSteps(rows: readonly DayRow[]): HeroStep[] {
  return rows.map((row, index) => ({
    ...row,
    id: row.topic,
    state: index === 0 ? "current" : "ahead",
  }));
}
