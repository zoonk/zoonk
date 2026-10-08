import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/**
 * A course's outline as learners see it: its chapters in level bands and order, each with its
 * lessons, plus what's needed to mark shared chapters and lessons (their home and how many
 * places use them).
 */
export const getCourseCurriculum = cacheAdminData((courseId: string) =>
  prisma.courseChapter.findMany({
    include: {
      chapter: {
        select: {
          _count: { select: { courses: true } },
          homeCourse: { select: { id: true, title: true } },
          id: true,
          lessons: {
            orderBy: { position: "asc" },
            select: {
              lesson: {
                select: {
                  _count: { select: { chapters: true } },
                  contentStatus: true,
                  homeChapterId: true,
                  id: true,
                  title: true,
                },
              },
              position: true,
            },
          },
          outlineStatus: true,
          title: true,
          visibility: true,
        },
      },
    },
    orderBy: [{ level: "asc" }, { position: "asc" }],
    where: { courseId },
  }),
);

export type CourseCurriculumChapter = Awaited<ReturnType<typeof getCourseCurriculum>>[number];
