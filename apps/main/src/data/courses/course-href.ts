import { type Course } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

export type AiCourseHref = `/b/${typeof AI_ORG_SLUG}/c/${string}`;

/**
 * AI-generated catalog courses all live under the public AI brand route. This
 * helper keeps start flows from hand-building that route in slightly different
 * ways as more entry points learn to reuse completed courses directly.
 */
export function getAiCourseHref(course: Pick<Course, "slug">): AiCourseHref {
  return `/b/${AI_ORG_SLUG}/c/${course.slug}`;
}

/** Learning history and parent navigation must keep the selected course edition. */
export function getOriginalCourseHref({
  brandSlug,
  courseSlug,
}: {
  brandSlug: string;
  courseSlug: string;
}) {
  return `/b/${brandSlug}/c/${courseSlug}?edition=original` as const;
}
