import { z } from "zod";

/**
 * The session screen's `?block=`: the block the learner just opened, from Today's queue, a
 * mission or Continue, so the screen shows that block (a question block under way, or a lesson's
 * wait) rather than the first one under way. A block that's already finished is ignored.
 */
export const SESSION_BLOCK_PARAM = "block";

export function readSessionBlockParam(value: unknown): string | null {
  const parsed = z.uuid().safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : null;
}
