import { parsePlanChangePayload } from "./plan-change-payload";

/**
 * Whether Today asks the learner about a change the plan made on its own: only falling behind
 * that puts the goal's date at risk, which waits for their choice. Everything else the plan does
 * by itself (missed days' lessons moved forward, a closer estimate, a rebalance, a moved
 * milestone, lessons a test or a missed question skipped or brought back) is the plan doing its
 * job: the Plan's history lists it, and the screen where it happened says it (a test-out's result
 * has its Undo). Will's Today said "Your plan changed" with a dozen topic names and "Leaves out
 * 194 lessons, adds about 212" after one missed day, and he couldn't tell whether he had to do
 * anything. Computed and stored Today notices have the same eligibility. Past the goal's date
 * there's no date left to put at risk: the day line says how the plan keeps going.
 */
export function asksAboutAutomaticChange({
  change,
  dateReached,
}: {
  change: { kind: string; payload: unknown };
  dateReached: boolean;
}): boolean {
  return (
    change.kind === "missedDays" &&
    !dateReached &&
    parsePlanChangePayload(change.payload).behind !== null
  );
}
