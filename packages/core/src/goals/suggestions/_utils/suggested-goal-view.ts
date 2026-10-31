import "server-only";
import { type SuggestedGoalStatus, prisma } from "@zoonk/db";
import { type SuggestedGoalView } from "../suggested-goal-contract";

export const suggestedGoalViewSelect = {
  courseId: true,
  id: true,
  status: true,
  title: true,
} as const;

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
