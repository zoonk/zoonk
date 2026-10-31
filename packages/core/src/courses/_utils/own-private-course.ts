export function getOwnPrivateCourseWhere(userId: string) {
  return { organizationId: null, userId, visibility: "private" as const };
}
