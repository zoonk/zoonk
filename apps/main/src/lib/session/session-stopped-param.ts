/**
 * The session screen's `?stopped`: the learner just stopped for today, so the screen shows what
 * changed so far instead of the next step. The rest of the session waits on Today, and opening the
 * session from there drops it.
 */
export const SESSION_STOPPED_PARAM = "stopped";

export const SESSION_STOPPED_HREF = `/session?${SESSION_STOPPED_PARAM}=1` as const;

export function readSessionStoppedParam(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}
