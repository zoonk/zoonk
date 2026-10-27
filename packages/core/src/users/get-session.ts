import "server-only";
import { auth } from "@zoonk/auth";
import { cacheTag } from "next/cache";
import { headers } from "next/headers";
import { getUserSessionCacheTag } from "../cache/tags";

/**
 * Resolves the authenticated cookie or bearer-token session at the business
 * boundary. The private cache joins repeated calls in the same Next.js render
 * tree without sharing a session across browsers or requests.
 */
export async function getSession() {
  "use cache: private";

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (session) {
    cacheTag(getUserSessionCacheTag(session.user.id));
  }

  return session;
}
