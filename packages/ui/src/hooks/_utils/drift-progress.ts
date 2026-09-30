/** Estimates are never the finish line: only the end of the work shows a full bar. */
const DRIFT_CAP = 97;

/** Without an estimate, a phase is assumed to take about half a minute. */
const DEFAULT_ESTIMATE_MS = 30_000;

/**
 * Where a progress bar should be while a phase runs: from `base` it closes in on the phase's end
 * (`target`) along an easing curve that covers most of the gap by the phase's estimated duration
 * and keeps creeping after it, so the bar never stops or overtakes the phase however long it runs.
 */
export function getDriftedProgress({
  base,
  elapsedMs,
  estimatedMs,
  target,
}: {
  base: number;
  elapsedMs: number;
  estimatedMs: number | null;
  target: number;
}): number {
  const ceiling = Math.min(target, DRIFT_CAP);

  if (base >= ceiling) {
    return base;
  }

  const timeConstant = (estimatedMs && estimatedMs > 0 ? estimatedMs : DEFAULT_ESTIMATE_MS) / 2;
  const share = 1 - Math.exp(-Math.max(0, elapsedMs) / timeConstant);

  return base + (ceiling - base) * share;
}
