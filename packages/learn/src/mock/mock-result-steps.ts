/**
 * What a finished mock's result can tell: the score (with each area and what the mock showed),
 * the essays of a full mock's written part, its speaking paper, how preparation moved with what
 * the mock offers to change in the plan, and the mistakes to review.
 */
export type MockResultPart = "essays" | "next" | "plan" | "score" | "speaking";

const ORDER: readonly MockResultPart[] = ["score", "essays", "speaking", "plan", "next"];

/** What sits beside the result on a wide screen, instead of a step of its own. */
const BESIDE: readonly MockResultPart[] = ["plan", "next"];

/**
 * The result's steps, in order, each only when it has something to say (`has`). On a phone the
 * plan and what's next are steps after the score; from `lg` they sit in the aside (`beside`), so
 * the score, the essays and the speaking paper are all the steps there are.
 */
export function getResultSteps(
  has: Readonly<Record<MockResultPart, boolean>>,
): { beside: boolean; part: MockResultPart }[] {
  return ORDER.filter((part) => has[part]).map((part) => ({ beside: BESIDE.includes(part), part }));
}

/** What the wide screen's aside holds: the plan and what's next, when the result has them. */
export function getResultAsideParts(
  has: Readonly<Record<MockResultPart, boolean>>,
): MockResultPart[] {
  return BESIDE.filter((part) => has[part]);
}
