import { type CourseLearningTarget } from "@zoonk/core/courses/learning-plan";

export function getLearningTargetHref(target: CourseLearningTarget) {
  if (target.generationStatus !== "completed") {
    return target.lessonId
      ? (`/generate/l/${target.lessonId}` as const)
      : (`/generate/ch/${target.chapterId}` as const);
  }

  if (target.lessonSlug) {
    return `/b/${target.brandSlug}/c/${target.courseSlug}/ch/${target.chapterSlug}/l/${target.lessonSlug}` as const;
  }

  return `/b/${target.brandSlug}/c/${target.courseSlug}/ch/${target.chapterSlug}` as const;
}
