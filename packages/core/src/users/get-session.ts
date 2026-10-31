import "server-only";
import { auth } from "@zoonk/auth";
import { cacheTag } from "next/cache";
import { headers } from "next/headers";
import { getUserSessionCacheTag } from "../cache/tags";

/** Resolves cookie or bearer identity; the private cache must never share sessions across requests or browsers. */
export async function getSession() {
  "use cache: private";

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (session) {
    cacheTag(getUserSessionCacheTag(session.user.id));
  }

  return session;
}
