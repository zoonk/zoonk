/** Estimates are never the finish line: only the end of the work shows a full bar. */
const DRIFT_CAP = 97;

const DEFAULT_ESTIMATE_MS = 30_000;

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
