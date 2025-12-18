import "server-only";

import { auth } from "@zoonk/auth";
import type { CoursePermission } from "@zoonk/auth/permissions";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";
import { cache } from "react";
import type { AuthOrganization, Organization } from "./types";

export type { CoursePermission } from "@zoonk/auth/permissions";

export function findOrganizationById(
  orgs: Organization[] | AuthOrganization[],
  orgId?: string | null,
) {
  return orgs.find((org) => Number(org.id) === Number(orgId)) ?? null;
}

export const getOrganizationBySlug = cache(
  async (slug: string): Promise<SafeReturn<Organization | null>> => {
    const { data: org, error } = await safeAsync(() =>
      prisma.organization.findUnique({
        where: { slug },
      }),
    );

    if (error) {
      return { data: null, error };
    }

    return { data: org ?? null, error: null };
  },
);

type HasCoursePermissionOptionsBase = {
  permission: CoursePermission;
  headers?: Headers;
};

type HasCoursePermissionOptionsWithOrgId = HasCoursePermissionOptionsBase & {
  orgId: number;
  orgSlug?: never;
};

type HasCoursePermissionOptionsWithOrgSlug = HasCoursePermissionOptionsBase & {
  orgId?: never;
  orgSlug: string;
};

type HasCoursePermissionOptions =
  | HasCoursePermissionOptionsWithOrgId
  | HasCoursePermissionOptionsWithOrgSlug;

export async function hasCoursePermission(
  opts: HasCoursePermissionOptions,
): Promise<boolean> {
  let organizationId: number;

  if ("orgSlug" in opts && opts.orgSlug) {
    const { data: org } = await getOrganizationBySlug(opts.orgSlug);

    if (!org) {
      return false;
    }

    organizationId = org.id;
  } else {
    organizationId = (opts as { orgId: number }).orgId;
  }

  const { data } = await safeAsync(async () =>
    auth.api.hasPermission({
      body: {
        organizationId: String(organizationId),
        permissions: { course: [opts.permission] },
      },
      headers: opts.headers ?? (await headers()),
    }),
  );

  if (!data) {
    return false;
  }

  return data.success;
}
