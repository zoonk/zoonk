import "server-only";
import { getPublishedLessonWhere } from "@zoonk/db";

/**
 * Player write commands must only act on lessons the learner can reach through
 * the product. Public brand courses are always eligible, while user-owned
 * organization-less courses are only eligible for their owner.
 */
export function getCompletableLessonWhere({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}) {
  return getPublishedLessonWhere({
    courseWhere: { OR: [{ organization: { kind: "brand" } }, { organizationId: null, userId }] },
    lessonWhere: { id: lessonId },
  });
}
