import { uuidSchema } from "@zoonk/utils/uuid-schema";

/** A saved block names its day itself (`?block=`), so a URL never has both. */
export const SESSION_GOAL_PARAM = "goal";

export function readSessionGoalParam(value: unknown): string | null {
  const parsed = uuidSchema().safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : null;
}
