import { type PlanView } from "@zoonk/core/plans/view-contract";

export type JourneyPathLinks = {
  chapter: (chapterId: string) => string;
  challenge: (planItemId: string) => string;
  exam: string | null;
};

export function getPlanLibraryCourse(
  plan: PlanView,
): { brandSlug: string; courseSlug: string } | null {
  const { course } = plan;

  return course?.brandSlug && course.planChapterCount > 0
    ? { brandSlug: course.brandSlug, courseSlug: course.courseSlug }
    : null;
}
