import "server-only";
import { type SuggestedGoalStatus, prisma } from "@zoonk/db";
import { type SuggestedGoalView } from "../suggested-goal-contract";

/** What a suggestion row needs to become a `SuggestedGoalView`. */
export const suggestedGoalViewSelect = {
  courseId: true,
  id: true,
  status: true,
  title: true,
} as const;

/**
 * A suggestion as the apps show it, with its course when anyone can still start it (a published,
 * public course), so accepting opens that course's start. A course gone since (a learner's own
 * course from before the Library) leaves only its title for onboarding.
 */
export async function toSuggestedGoalView(row: {
  courseId: string;
  id: string;
  status: SuggestedGoalStatus;
  title: string;
}): Promise<SuggestedGoalView> {
  const course = await prisma.course.findFirst({
    select: { id: true },
    where: { id: row.courseId, isPublished: true, visibility: "public" },
  });

  return { courseId: course?.id ?? null, id: row.id, status: row.status, title: row.title };
}
