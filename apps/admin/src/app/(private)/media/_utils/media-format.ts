const MS_PER_SECOND = 1000;
const DURATION_DIGITS = 1;

/** Images report their pixel size and audio its length; either may be unknown. */
export function formatMediaSize({
  durationMs,
  height,
  width,
}: {
  durationMs: number | null;
  height: number | null;
  width: number | null;
}): string {
  if (width && height) {
    return `${width} × ${height}`;
  }

  if (durationMs) {
    return `${(durationMs / MS_PER_SECOND).toFixed(DURATION_DIGITS)} s`;
  }

  return "—";
}

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "3 steps": how many lesson screens show the asset. */
export function formatMediaUsage(counts: { steps: number }) {
  return counts.steps > 0 ? formatCount(counts.steps, "step") : "Unused";
}
