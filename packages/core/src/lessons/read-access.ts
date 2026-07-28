import { getPublishedLessonWhere } from "@zoonk/db";

/**
 * Restricts raw-ID player reads to curriculum that is public today. Brand
 * courses are public to every caller, while organization-less personal
 * courses are visible only to their owner. School and team membership rules
 * are intentionally excluded until those product permissions are implemented.
 */
export function getReadableLessonWhere({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string | null;
}) {
  return getPublishedLessonWhere({
    courseWhere: userId
      ? { OR: [{ organization: { kind: "brand" } }, { organizationId: null, userId }] }
      : { organization: { kind: "brand" } },
    lessonWhere: { id: lessonId },
  });
}
