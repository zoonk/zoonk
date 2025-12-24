import "server-only";

import { auth } from "@zoonk/auth";
import type { CoursePermission } from "@zoonk/auth/permissions";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";
import { cache } from "react";
import { getOrganization } from "./organizations/get-organization";
import type { AuthOrganization, Organization } from "./types";

async function getOrganizationId({
  orgId,
  orgSlug,
}: {
  orgId?: number;
  orgSlug?: string;
}): Promise<number | null> {
  if (orgId) {
    return orgId;
  }

  if (orgSlug) {
    const { data: org } = await getOrganization(orgSlug);
    return org?.id ?? null;
  }

  return null;
}

export function findOrganizationById(
  orgs: Organization[] | AuthOrganization[],
  orgId?: string | null,
) {
  return orgs.find((org) => Number(org.id) === Number(orgId)) ?? null;
}

export const hasCoursePermission = cache(
  async (opts: {
    permission: CoursePermission;
    headers?: Headers;
    orgId?: number;
    orgSlug?: string;
  }): Promise<boolean> => {
    const organizationId = await getOrganizationId(opts);

    if (!organizationId) {
      return false;
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
  },
);
