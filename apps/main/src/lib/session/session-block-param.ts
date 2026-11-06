import { uuidSchema } from "@zoonk/utils/uuid-schema";

export const SESSION_BLOCK_PARAM = "block";

export function readSessionBlockParam(value: unknown): string | null {
  const parsed = uuidSchema().safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : null;
}
