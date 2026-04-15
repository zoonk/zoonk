import "server-only";
import { getAuthorizedActiveCourse } from "@/data/courses/get-authorized-course";
import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function toggleCoursePublished(params: {
  courseId: number;
  headers?: Headers;
  isPublished: boolean;
}): Promise<SafeReturn<Course>> {
  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
  }

  const { data, error } = await safeAsync(() =>
    params.isPublished
      ? prisma.$transaction(async (tx) => {
          const updated = await tx.course.update({
            data: { isPublished: true },
            where: { id: course.id },
          });

          await Promise.all([
            tx.chapter.updateMany({
              data: { isPublished: true },
              where: { archivedAt: null, courseId: course.id },
            }),
            tx.lesson.updateMany({
              data: { isPublished: true },
              where: {
                archivedAt: null,
                chapter: {
                  archivedAt: null,
                  courseId: course.id,
                },
              },
            }),
            tx.activity.updateMany({
              data: { isPublished: true },
              where: {
                archivedAt: null,
                lesson: {
                  archivedAt: null,
                  chapter: {
                    archivedAt: null,
                    courseId: course.id,
                  },
                },
              },
            }),
            tx.step.updateMany({
              data: { isPublished: true },
              where: {
                activity: {
                  archivedAt: null,
                  lesson: {
                    archivedAt: null,
                    chapter: {
                      archivedAt: null,
                      courseId: course.id,
                    },
                  },
                },
                archivedAt: null,
              },
            }),
          ]);

          return updated;
        })
      : prisma.course.update({
          data: { isPublished: false },
          where: { id: course.id },
        }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
