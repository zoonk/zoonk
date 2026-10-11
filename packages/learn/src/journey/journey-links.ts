import { type PlanView } from "@zoonk/core/plans/view-contract";

/** Where the Journey's path leads: each chapter's page, a phase's challenge and the exam's page. */
export type JourneyPathLinks = {
  chapter: (chapterId: string) => string;
  challenge: (planItemId: string) => string;
  /** An exam goal's "About the exam", the path's finish; null for other goals. */
  exam: string | null;
};

/** The Library course a plan picks some chapters of, when it has a public page to see all of it. */
export function getPartialCourse(plan: PlanView): { brandSlug: string; courseSlug: string } | null {
  const { course } = plan;

  if (!course?.brandSlug || course.planChapterCount === 0) {
    return null;
  }

  return course.planChapterCount < course.chapterCount
    ? { brandSlug: course.brandSlug, courseSlug: course.courseSlug }
    : null;
}
