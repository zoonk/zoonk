import "server-only";

import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";

export async function getOrganizationId(
  slug: string,
): Promise<SafeReturn<number | null>> {
  const { data: org, error } = await safeAsync(() =>
    prisma.organization.findUnique({
      select: { id: true },
      where: { slug },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: org?.id ?? null, error: null };
}

export async function canReadCourses(
  organizationId: number,
  opts?: { headers?: Headers },
): Promise<boolean> {
  const { data } = await safeAsync(async () =>
    auth.api.hasPermission({
      body: {
        organizationId: String(organizationId),
        permissions: { course: ["read"] },
      },
      headers: opts?.headers ?? (await headers()),
    }),
  );

  if (!data) {
    return false;
  }

  return data.success;
}

export async function canUpdateCourses(
  organizationId: number,
  opts?: { headers?: Headers },
): Promise<boolean> {
  const { data } = await safeAsync(async () =>
    auth.api.hasPermission({
      body: {
        organizationId: String(organizationId),
        permissions: { course: ["update"] },
      },
      headers: opts?.headers ?? (await headers()),
    }),
  );

  if (!data) {
    return false;
  }

  return data.success;
}
