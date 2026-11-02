export const WARNING_SECONDS = 10;

const SECOND_WARNING_SECONDS = 5;

const ANNOUNCED_SECONDS: ReadonlySet<number> = new Set([WARNING_SECONDS, SECOND_WARNING_SECONDS]);

/** Only at a few marks: saying it every second would talk over the question. */
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
