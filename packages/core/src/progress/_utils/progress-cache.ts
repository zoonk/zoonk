import "server-only";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";

/** Tags a private progress result with the learner whose data it contains. */
export async function getProgressSession() {
  const session = await getSession();

  if (session) {
    cacheTag(getUserProgressCacheTag(session.user.id));
  }

  return session;
}
