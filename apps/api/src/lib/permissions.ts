import { type CoursePermission } from "@zoonk/auth/permissions";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";

export function canAccessOrg(
  apiKey: {
    orgSlug: string | null;
    isSystemKey: boolean;
  },
  targetOrgSlug: string,
): boolean {
  if (apiKey.isSystemKey) {
    return true;
  }

  return apiKey.orgSlug === targetOrgSlug;
}

export async function checkCoursePermission(
  permission: CoursePermission,
  orgSlug: string,
  headers: Headers,
): Promise<boolean> {
  return hasCoursePermission({ headers, orgSlug, permission });
}
