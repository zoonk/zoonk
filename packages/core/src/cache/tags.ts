import { createHash } from "node:crypto";
import { appCacheTagSchema } from "./app-cache-contract";

/**
 * Every app importing cached core reads must register the same named profiles.
 * @public App build configuration consumes this supported profile contract.
 */
export const CACHE_LIFE_PROFILES = {
  catalog: { expire: 86_400, revalidate: 600, stale: 300 },
  learner: { stale: 900 },
};

export const COURSE_LIST_CACHE_TAG = "catalog-courses";

const SHARED_CONTENT_PREFIXES = [
  "course:",
  "course-route:",
  "course-route-hash:",
  "course-curriculum:",
  "library-chapter:",
  "library-lesson:",
  "skill:",
  "media-asset:",
  "exam-blueprint:",
];

/** Only shared content crosses app caches; a learner's private tags stay in the writing app. */
export function isSharedContentTag(tag: string): boolean {
  return (
    tag === COURSE_LIST_CACHE_TAG ||
    SHARED_CONTENT_PREFIXES.some((prefix) => tag.startsWith(prefix) && tag.length > prefix.length)
  );
}

/** Identifies every cached view of one course without coupling callers to tag formatting. */
export function getCourseCacheTag(courseId: string): string {
  return `course:${courseId}`;
}

/** Identifies a course lookup even when the route does not resolve to a row yet. */
export function getCourseRouteCacheTag(input: { brandSlug: string; courseSlug: string }): string {
  const tag = `course-route:${input.brandSlug}:${input.courseSlug}`;

  if (appCacheTagSchema.safeParse(tag).success) {
    return tag;
  }

  /** Legacy slugs stay byte for byte; hash the pair into a distinct, bounded tag namespace. */
  const hash = createHash("sha256")
    .update(JSON.stringify([input.brandSlug, input.courseSlug]))
    .digest("hex");

  return `course-route-hash:${hash}`;
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

/** Identifies private reads of one learner's profile: buddy, birth month and year, active goal. */
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
