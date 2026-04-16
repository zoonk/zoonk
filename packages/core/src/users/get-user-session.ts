import "server-only";
import { auth } from "@zoonk/auth";
import { headers } from "next/headers";
import { cache } from "react";

/**
 * Read the current auth session exactly as Better Auth returns it.
 *
 * Auth now owns string ID generation again, so normalizing these ids would only
 * reintroduce the legacy numeric contract we are removing.
 */
export const getSession = cache(async (reqHeaders?: Headers) =>
  auth.api.getSession({
    headers: reqHeaders ?? (await headers()),
  }),
);
