import { z } from "zod";

export const SESSION_BLOCK_PARAM = "block";

export function readSessionBlockParam(value: unknown): string | null {
  const parsed = z.uuid().safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : null;
}
