export type MockResultPart = "essays" | "plan" | "score" | "speaking";

const ORDER: readonly MockResultPart[] = ["score", "essays", "speaking", "plan"];

const BESIDE: readonly MockResultPart[] = ["plan"];

export function getResultSteps(
  has: Readonly<Record<MockResultPart, boolean>>,
): { beside: boolean; part: MockResultPart }[] {
  return ORDER.filter((part) => has[part]).map((part) => ({ beside: BESIDE.includes(part), part }));
}

export function getResultAsideParts(
  has: Readonly<Record<MockResultPart, boolean>>,
): MockResultPart[] {
  return BESIDE.filter((part) => has[part]);
}
