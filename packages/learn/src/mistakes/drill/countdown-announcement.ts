/** The last seconds turn the clock amber and are said to screen readers. */
export const WARNING_SECONDS = 10;

/** Halfway through the last seconds, the clock says how many are left once more. */
const SECOND_WARNING_SECONDS = 5;

const ANNOUNCED_SECONDS: ReadonlySet<number> = new Set([WARNING_SECONDS, SECOND_WARNING_SECONDS]);

/**
 * The seconds left the clock last said to screen readers, as they tick: none before the last
 * seconds, then the real seconds left when they start (all of them, for a question shorter than
 * that) and again at each announced mark. Saying it every second would talk over the question.
 */
export function getAnnouncedSeconds({
  announced,
  secondsLeft,
}: {
  announced: number | null;
  secondsLeft: number;
}): number | null {
  if (secondsLeft > WARNING_SECONDS) {
    return null;
  }

  return announced === null || ANNOUNCED_SECONDS.has(secondsLeft) ? secondsLeft : announced;
}
