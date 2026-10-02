export const COURSE_LIST_CACHE_TAG = "catalog-courses";

/** Identifies every cached view of one course without coupling callers to tag formatting. */
export function getCourseCacheTag(courseId: string): string {
  return `course:${courseId}`;
}

/** Identifies a course lookup even when the route does not resolve to a row yet. */
export function getCourseRouteCacheTag(input: { brandSlug: string; courseSlug: string }): string {
  return `course-route:${input.brandSlug}:${input.courseSlug}`;
}

/** Identifies cached chapter navigation and outlines owned by one course. */
export function getCourseCurriculumCacheTag(courseId: string): string {
  return `course-curriculum:${courseId}`;
}

/** Identifies every cached view of one shared Library chapter, including outlines that list it. */
export function getLibraryChapterCacheTag(chapterId: string): string {
  return `library-chapter:${chapterId}`;
}

/** Identifies every cached view of one shared Library lesson, including chapters that list it. */
export function getLibraryLessonCacheTag(lessonId: string): string {
  return `library-lesson:${lessonId}`;
}

/** Identifies cached views of one skill, including the skill a merged duplicate points to. */
export function getSkillCacheTag(skillId: string): string {
  return `skill:${skillId}`;
}

/** Identifies the cached read of one image or audio asset. */
export function getMediaAssetCacheTag(assetId: string): string {
  return `media-asset:${assetId}`;
}

/** Identifies cached progress data that must change after a learner write. */
export function getUserProgressCacheTag(userId: string): string {
  return `user-progress:${userId}`;
}

/** Identifies private session resources that contain one authenticated user's profile fields. */
export function getUserSessionCacheTag(userId: string): string {
  return `user-session:${userId}`;
}

/** Identifies private billing reads whose entitlement changes after provider reconciliation. */
export function getUserSubscriptionCacheTag(userId: string): string {
  return `user-subscription:${userId}`;
}

/**
 * Identifies private reads of one learner's model: skills and study cards, the mistakes notebook
 * and goal preparation. Anything that changes answers, skills, plan items or mocks revalidates it.
 */
export function getLearnerModelCacheTag(userId: string): string {
  return `learner-model:${userId}`;
}

/** Identifies every cached view of one exam blueprint, revalidated when a new notice changes it. */
export function getExamBlueprintCacheTag(blueprintId: string): string {
  return `exam-blueprint:${blueprintId}`;
}

/** Identifies private reads of one learner's profile: mode, buddy, birth month and year, active goal. */
export function getLearningProfileCacheTag(userId: string): string {
  return `learning-profile:${userId}`;
}

/** Identifies the private allowance read that changes whenever the learner claims usage. */
export function getAllowanceCacheTag(userId: string): string {
  return `allowance:${userId}`;
}

/** Identifies private reads of one learner's memory: facts, the memory switch and insights. */
export function getMemoryCacheTag(userId: string): string {
  return `memory:${userId}`;
}

/** Identifies private reads of one learner's goals and plans, including plan changes and links. */
export function getGoalsCacheTag(userId: string): string {
  return `goals:${userId}`;
}

/** Identifies the private read of the instruments one learner is waiting to learn to play. */
export function getInstrumentWaitlistCacheTag(userId: string): string {
  return `instrument-waitlist:${userId}`;
}
