import { apportion, roundToTotal } from "@zoonk/utils/apportion";
import { type MockSectionPlan } from "./mock-plan";

export function fitToClock({
  clock,
  sections,
}: {
  clock?: number;
  sections: readonly MockSectionPlan[];
}): MockSectionPlan[] {
  const weights = sections.map((section) => section.minutes);

  const minutes =
    clock === undefined ? roundToTotal(weights) : apportion({ total: clock, weights });

  return sections.map((section, index) => ({ ...section, minutes: minutes[index] ?? 0 }));
}
