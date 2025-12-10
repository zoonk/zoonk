import "server-only";

import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { cacheTagUsers } from "@zoonk/utils/cache";
import { safeAsync } from "@zoonk/utils/error";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { cache } from "react";
import type { AuthOrganization } from "./types";

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

export const listUserOrgs = cache(
  async (): Promise<{ data: AuthOrganization[]; error: Error | null }> => {
    const { data, error } = await safeAsync(async () =>
      auth.api.listOrganizations({
        headers: await headers(),
      }),
    );

    if (error) {
      return { data: [], error };
    }

    return { data: data ?? [], error: null };
  },
);
