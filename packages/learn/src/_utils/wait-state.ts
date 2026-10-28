const SLOW_MS = 1500;

const VERY_SLOW_MS = 15_000;

export type WaitState = "none" | "slow" | "verySlow";

export function getWaitState(elapsedMs: number): WaitState {
  if (elapsedMs >= VERY_SLOW_MS) {
    return "verySlow";
  }

  return elapsedMs >= SLOW_MS ? "slow" : "none";
}

export function getWaitChanges(elapsedMs: number): number[] {
  return [SLOW_MS, VERY_SLOW_MS]
    .filter((threshold) => threshold > elapsedMs)
    .map((threshold) => threshold - elapsedMs);
}
