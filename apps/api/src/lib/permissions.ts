import { type CoursePermission } from "@zoonk/auth/permissions";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";

export async function checkCoursePermission(
  permission: CoursePermission,
  orgSlug: string,
  headers: Headers,
): Promise<boolean> {
  return hasCoursePermission({ headers, orgSlug, permission });
}
