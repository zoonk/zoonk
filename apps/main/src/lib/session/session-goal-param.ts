import { z } from "zod";

/**
 * The session screen's `?goal=`: the goal whose day a tap opened before that day had a saved block
 * to name (a day not opened yet), so the screen shows that goal's day even when another goal is
 * active by then. A saved block names its day itself (`?block=`), so a URL never has both.
 */
export const SESSION_GOAL_PARAM = "goal";

export function readSessionGoalParam(value: unknown): string | null {
  const parsed = z.uuid().safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : null;
}
