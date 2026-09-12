import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../../users/get-session";
import { getReadableCourseWhere } from "../course-access";
import { OPTIONAL_LESSON_KINDS } from "../learning-plan-contract";

export async function loadContexts(courseIds: string[]) {
  const session = await getSession();
  const userId = session?.user.id ?? null;

  const [courses, plans] = await Promise.all([
    prisma.course.findMany({
      include: {
        chapters: {
          include: {
            lessons: {
              orderBy: { position: "asc" },
              where: {
                isPublished: true,
                kind: { notIn: [...OPTIONAL_LESSON_KINDS] },
                sourceLessonId: null,
              },
            },
          },
          orderBy: { position: "asc" },
          where: { isPublished: true },
        },
        organization: true,
      },
      where: { AND: [getReadableCourseWhere(userId) ?? {}, { id: { in: courseIds } }] },
    }),
    userId
      ? prisma.courseLearningPlan.findMany({ where: { courseId: { in: courseIds }, userId } })
      : [],
  ]);

  const plansByCourse = new Map(plans.map((plan) => [plan.courseId, plan]));
  return courses.map((course) => ({ course, plan: plansByCourse.get(course.id) ?? null, userId }));
}

export async function loadContext(courseId: string) {
  const contexts = await loadContexts([courseId]);
  return contexts[0] ?? null;
}
