import "server-only";
import { auth } from "@zoonk/auth";
import { headers } from "next/headers";
import { cache } from "react";
import { serializeUserSession } from "./serialize-user-session";

/**
 * Read the current auth session and normalize ids to the numeric shape used by
 * Prisma-backed application code.
 *
 * Most server code joins session data directly against numeric foreign keys.
 * Returning the normalized shape here keeps that boundary consistent and avoids
 * repeated conversion logic at every caller.
 */
export const getSession = cache(async (reqHeaders?: Headers) => {
  const session = await auth.api.getSession({
    headers: reqHeaders ?? (await headers()),
  });

  return serializeUserSession(session);
});
