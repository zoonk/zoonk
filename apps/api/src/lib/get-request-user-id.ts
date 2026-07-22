import "server-only";
import { getSession } from "@zoonk/core/users/session/get";

/**
 * Resolves the authenticated user from request headers so API resource ids can
 * never be mistaken for trusted identity when routes call user-scoped queries.
 */
export async function getRequestUserId(headers: Headers): Promise<string | null> {
  const session = await getSession(headers);
  return session?.user.id ?? null;
}
