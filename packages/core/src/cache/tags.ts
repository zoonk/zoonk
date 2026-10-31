import { createHash } from "node:crypto";

export const COURSE_LIST_CACHE_TAG = "catalog-courses";

export function getCourseCacheTag(courseId: string): string {
  return `course:${courseId}`;
}

/** Hash route values to stay within Next.js's 256-character cache-tag limit. */
export function getCourseRouteCacheTag(input: { brandSlug: string; courseSlug: string }): string {
  const hash = createHash("sha256")
    .update(JSON.stringify([input.brandSlug, input.courseSlug]))
    .digest("hex");

  return `course-route:${hash}`;
}

export function getCourseCurriculumCacheTag(courseId: string): string {
  return `course-curriculum:${courseId}`;
}

export function getLibraryChapterCacheTag(chapterId: string): string {
  return `library-chapter:${chapterId}`;
}

export function getLibraryLessonCacheTag(lessonId: string): string {
  return `library-lesson:${lessonId}`;
}

export function getSkillCacheTag(skillId: string): string {
  return `skill:${skillId}`;
}

export function getMediaAssetCacheTag(assetId: string): string {
  return `media-asset:${assetId}`;
}

export function getUserProgressCacheTag(userId: string): string {
  return `user-progress:${userId}`;
}

export function getUserSessionCacheTag(userId: string): string {
  return `user-session:${userId}`;
}

export function getUserSubscriptionCacheTag(userId: string): string {
  return `user-subscription:${userId}`;
}

export function getLearnerModelCacheTag(userId: string): string {
  return `learner-model:${userId}`;
}

export function getExamBlueprintCacheTag(blueprintId: string): string {
  return `exam-blueprint:${blueprintId}`;
}

export function getLearningProfileCacheTag(userId: string): string {
  return `learning-profile:${userId}`;
}

export function getAllowanceCacheTag(userId: string): string {
  return `allowance:${userId}`;
}

export function getMemoryCacheTag(userId: string): string {
  return `memory:${userId}`;
}

export function getGoalsCacheTag(userId: string): string {
  return `goals:${userId}`;
}

export function getInstrumentWaitlistCacheTag(userId: string): string {
  return `instrument-waitlist:${userId}`;
}
