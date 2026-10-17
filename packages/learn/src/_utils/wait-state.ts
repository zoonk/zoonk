/** A tap that answers within this long needs no word; past it, the screen says it's on its way. */
const SLOW_MS = 1500;

/** Past this, it says it's taking longer than usual, and that tapping again isn't needed. */
const VERY_SLOW_MS = 15_000;

export type WaitState = "none" | "slow" | "verySlow";

/** What a wait says this long after the tap: nothing yet, that it's on its way, or that it's slow. */
export function getWaitState(elapsedMs: number): WaitState {
  if (elapsedMs >= VERY_SLOW_MS) {
    return "verySlow";
  }

  return elapsedMs >= SLOW_MS ? "slow" : "none";
}

/** How long from now until each line a wait this old still has to say. */
export function getWaitChanges(elapsedMs: number): number[] {
  return [SLOW_MS, VERY_SLOW_MS]
    .filter((threshold) => threshold > elapsedMs)
    .map((threshold) => threshold - elapsedMs);
}
