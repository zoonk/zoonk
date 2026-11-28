import { type TransactionClient } from "@zoonk/db";

const membership = {
  select: { family: { select: { courses: { select: { id: true } } } }, format: true, id: true },
} as const;

/**
 * Each course opens the newest active goal that started from or follows any of its editions. An
 * exam goal opens only from an exam course, never from a subject course the exam reuses.
 */
export async function getCourseGoalIds(db: TransactionClient, userId: string) {
  const goals = await db.goal.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, kind: true, primaryCourse: membership, sourceCourse: membership },
    where: {
      OR: [{ primaryCourseId: { not: null } }, { sourceCourseId: { not: null } }],
      kind: { not: "explain" },
      status: "active",
      userId,
    },
  });

  const matches = goals.flatMap((goal) =>
    [goal.primaryCourse, goal.sourceCourse].flatMap((course) =>
      course && (goal.kind !== "exam" || course.format === "exam")
        ? (course.family?.courses ?? [course]).map(({ id }) => [id, goal.id] as const)
        : [],
    ),
  );

  return new Map(matches);
}
