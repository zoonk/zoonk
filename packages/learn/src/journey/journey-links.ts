import { type PlanView } from "@zoonk/core/plans/view-contract";

export type JourneyPathLinks = {
  chapter: (chapterId: string) => string;
  challenge: (planItemId: string) => string;
  exam: string | null;
};

export function getPartialCourse(plan: PlanView): { brandSlug: string; courseSlug: string } | null {
  const { course } = plan;

  if (!course?.brandSlug || course.planChapterCount === 0) {
    return null;
  }

  return course.planChapterCount < course.chapterCount
    ? { brandSlug: course.brandSlug, courseSlug: course.courseSlug }
    : null;
}
