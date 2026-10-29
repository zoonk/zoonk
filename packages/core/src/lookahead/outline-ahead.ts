export const OUTLINE_AHEAD_DAYS = 14;

/** Today's stand-ins reserve visible study time, so their outlines need foreground priority. */
export const OUTLINE_SOON_DAYS = 0;

/** An outline asked for or running this long without a change has nobody writing it. */
const OUTLINE_STALE_AFTER_MS = 900_000;

export function getOutlineStaleBefore(now: Date): Date {
  return new Date(now.getTime() - OUTLINE_STALE_AFTER_MS);
}
