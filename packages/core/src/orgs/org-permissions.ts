import "server-only";
import { auth } from "@zoonk/auth";
import { type CoursePermission } from "@zoonk/auth/permissions";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";
import { cache } from "react";
import { getOrganization } from "./get-org";

async function getOrganizationId({
  orgId,
  orgSlug,
}: {
  orgId?: string | null;
  orgSlug?: string;
}): Promise<string | null> {
  if (orgId) {
    return orgId;
  }

  if (orgSlug) {
    const { data: org } = await getOrganization(orgSlug);
    return org?.id ?? null;
  }

  return null;
}

const cachedHasCoursePermission = cache(
  async (
    permission: CoursePermission,
    orgId: string | null | undefined,
    orgSlug: string | undefined,
    reqHeaders?: Headers,
  ): Promise<boolean> => {
    const organizationId = await getOrganizationId({ orgId, orgSlug });

    if (!organizationId) {
      return false;
    }

    const { data } = await safeAsync(async () =>
      auth.api.hasPermission({
        body: {
          organizationId,
          permissions: { course: [permission] },
        },
        headers: reqHeaders ?? (await headers()),
      }),
    );

    if (!data) {
      return false;
    }

    return data.success;
  },
);

export function hasCoursePermission(opts: {
  permission: CoursePermission;
  headers?: Headers;
  orgId?: string | null;
  orgSlug?: string;
}): Promise<boolean> {
  return cachedHasCoursePermission(opts.permission, opts.orgId, opts.orgSlug, opts.headers);
}
