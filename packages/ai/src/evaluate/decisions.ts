function assertProbability(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a probability between 0 and 1. Received: ${value}.`);
  }
}

/**
 * Turns a boolean answer's P(true) into a verdict: true once it reaches the threshold. Thresholds
 * are parameters because providers don't share a calibration: the right cutoff for one question
 * and model comes from labeled eval data.
 */
export function decideBoolean({
  probability,
  threshold,
}: {
  probability: number;
  threshold: number;
}): boolean {
  assertProbability("probability", probability);
  assertProbability("threshold", threshold);

  return probability >= threshold;
}
