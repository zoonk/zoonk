import "server-only";

import { auth } from "@zoonk/auth";
import type { CoursePermission } from "@zoonk/auth/permissions";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";
import { cache } from "react";

export type { CoursePermission } from "@zoonk/auth/permissions";

export const getOrganizationId = cache(
  async (slug: string): Promise<SafeReturn<number | null>> => {
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
  },
);

export async function hasCoursePermission(
  organizationId: number,
  permission: CoursePermission,
  opts?: { headers?: Headers },
): Promise<boolean> {
  const { data } = await safeAsync(async () =>
    auth.api.hasPermission({
      body: {
        organizationId: String(organizationId),
        permissions: { course: [permission] },
      },
      headers: opts?.headers ?? (await headers()),
    }),
  );

  if (!data) {
    return false;
  }

  return data.success;
}
