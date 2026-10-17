import "server-only";
import { auth } from "@zoonk/auth";
import { getSessionReadQuery } from "@zoonk/auth/session-refresh";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { getUserSessionCacheTag } from "../cache/tags";

/**
 * Resolves the authenticated cookie or bearer-token session at the business
 * boundary. The private cache joins repeated calls in the same Next.js render
 * tree without sharing a session across browsers or requests. It can't set
 * cookies, so cookie sessions renew through Better Auth's own browser request.
 */
export async function getSession() {
  "use cache: private";

  cacheLife({ stale: Infinity });

  const requestHeaders = await headers();

  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: getSessionReadQuery(requestHeaders),
  });

  if (session) {
    cacheTag(getUserSessionCacheTag(session.user.id));
  }

  return session;
}
