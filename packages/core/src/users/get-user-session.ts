import "server-only";
import { auth } from "@zoonk/auth";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async (reqHeaders?: Headers) => {
  const session = await auth.api.getSession({
    headers: reqHeaders ?? (await headers()),
  });

  return session;
});
