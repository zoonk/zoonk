import { type MockSectionPlan } from "./mock-plan";

/**
 * A scheduled mock's sections on its whole clock: the time of a section it can't sit (an area or a
 * written part the bank has nothing for yet, a listening section without recordings) goes to the
 * ones it sits, each in proportion to its own, so the mock runs as long as its plan funded.
 */
export function fitToClock({
  clock,
  sections,
}: {
  clock: number;
  sections: readonly MockSectionPlan[];
}): MockSectionPlan[] {
  const total = sections.reduce((sum, section) => sum + section.minutes, 0);

  if (total <= 0) {
    return [...sections];
  }

  const scaled = sections.map((section) => Math.round((section.minutes * clock) / total));
  const rest = clock - scaled.slice(0, -1).reduce((sum, minutes) => sum + minutes, 0);

  return sections.map((section, index) => ({
    ...section,
    minutes: index === sections.length - 1 ? rest : (scaled[index] ?? section.minutes),
  }));
}
