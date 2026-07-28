import { type GenerationStatus, getPublishedLessonWhere } from "@zoonk/db";

/**
 * Player write commands must only act on lessons the learner can reach through
 * the product. Public brand courses are always eligible, while user-owned
 * organization-less courses are only eligible for their owner.
 */
export function getCompletableLessonWhere({
  generationStatus,
  lessonId,
  userId,
}: {
  generationStatus?: GenerationStatus;
  lessonId: string;
  userId: string;
}) {
  return getPublishedLessonWhere({
    courseWhere: { OR: [{ organization: { kind: "brand" } }, { organizationId: null, userId }] },
    lessonWhere: { generationStatus, id: lessonId },
  });
}
