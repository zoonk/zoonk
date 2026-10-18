/**
 * A learner's private course: made for their own goal, with no organization and never published.
 * My courses lists it and the catalog opens it for that learner only, so both share this filter.
 */
export function getOwnPrivateCourseWhere(userId: string) {
  return { organizationId: null, userId, visibility: "private" as const };
}
