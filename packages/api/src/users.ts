import "server-only";

import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { cacheTagUsers } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
});

export async function sendVerificationOTP(email: string) {
  const data = await auth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
  });

  return { data };
}

export async function countUsers() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTagUsers());

  return prisma.user.count();
}
