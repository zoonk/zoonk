import "server-only";

import { auth } from "@zoonk/auth";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async (params?: { headers?: Headers }) => {
  const session = await auth.api.getSession({
    headers: params?.headers ?? (await headers()),
  });

  return session;
});
