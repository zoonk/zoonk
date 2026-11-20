import { type TransactionClient } from "@zoonk/db";

const membership = {
  select: { family: { select: { courses: { select: { id: true } } } }, id: true },
} as const;

/** Each course opens the newest active goal that started from or follows any of its editions. */
export async function getCourseGoalIds(db: TransactionClient, userId: string) {
  const goals = await db.goal.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, primaryCourse: membership, sourceCourse: membership },
    where: {
      OR: [{ primaryCourseId: { not: null } }, { sourceCourseId: { not: null } }],
      kind: { not: "explain" },
      status: "active",
      userId,
    },
  });

  const matches = goals.flatMap((goal) =>
    [goal.primaryCourse, goal.sourceCourse].flatMap((course) =>
      course ? (course.family?.courses ?? [course]).map(({ id }) => [id, goal.id] as const) : [],
    ),
  );

  return new Map(matches);
}
