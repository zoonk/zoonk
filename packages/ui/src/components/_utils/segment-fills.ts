const PERCENT = 100;

export type GenerationTimelineStepStatus = "active" | "completed" | "failed" | "pending";

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isRunning(status: GenerationTimelineStepStatus | undefined): boolean {
  return status === "active" || status === "failed";
}

/**
 * Each part fills by its own step: a done step's part is full, a waiting step's is empty, and the
 * running steps share what the bar has moved past the done ones. Steps that run side by side can
 * finish in any order, so a part never fills just because the parts before it did.
 */
export function getSegmentFills({
  statuses,
  value,
  weights,
}: {
  statuses: readonly GenerationTimelineStepStatus[];
  value: number;
  weights: readonly number[];
}): number[] {
  const sizes = weights.map((weight) => Math.max(0, weight));
  const reached = (Math.min(PERCENT, Math.max(0, value)) / PERCENT) * sum(sizes);
  const done = sum(sizes.filter((_, index) => statuses[index] === "completed"));
  const running = sum(sizes.filter((_, index) => isRunning(statuses[index])));
  const runningFill = running === 0 ? 0 : Math.min(1, Math.max(0, (reached - done) / running));

  return sizes.map((size, index) => {
    if (size === 0) {
      return 0;
    }

    if (statuses[index] === "completed") {
      return 1;
    }

    return isRunning(statuses[index]) ? runningFill : 0;
  });
}
