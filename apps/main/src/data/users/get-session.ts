import "server-only";
import { getUserSessionCacheTag } from "@/data/cache-tags";
import { getSession as getRawSession } from "@zoonk/core/users/session/get";
import { cacheTag } from "next/cache";

/**
 * The current request remains the only source of authenticated identity. The
 * private app boundary supports runtime prefetching without allowing callers to
 * provide a user id or storing session data in the shared server cache.
 */
export async function getSession() {
  "use cache: private";

  const session = await getRawSession();

  if (session) {
    cacheTag(getUserSessionCacheTag(session.user.id));
  }

  return session;
}
