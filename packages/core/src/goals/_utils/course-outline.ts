import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { type CourseOutlineChapter } from "./course-plan-graph";

/**
 * A course's chapters in course order (level band, then position), each with the lessons a plan
 * can teach (visible to the learner and not set aside, like the planner reads them) and their
 * skills, and the skills an outline tagged the chapter with. Empty for a course nobody outlined.
 */
export async function loadCourseOutline({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<CourseOutlineChapter[]> {
  const visible = libraryRowsVisibleTo(userId);

  const placements = await prisma.courseChapter.findMany({
    include: {
      chapter: {
        select: {
          goalSkills: {
            orderBy: { createdAt: "asc" },
            select: { skill: { select: { id: true, name: true } } },
          },
          lessons: {
            orderBy: { position: "asc" },
            select: {
              lesson: {
                select: {
                  skills: {
                    orderBy: { createdAt: "asc" },
                    select: { skill: { select: { id: true, name: true } } },
                  },
                },
              },
            },
            where: { lesson: { ...visible, setAsideAt: null } },
          },
        },
      },
    },
    orderBy: [{ level: "asc" }, { position: "asc" }],
    where: { chapter: visible, courseId },
  });

  return placements.map((placement) => ({
    chapterId: placement.chapterId,
    lessons: placement.chapter.lessons.map((entry) => entry.lesson.skills.map((row) => row.skill)),
    level: placement.level,
    position: placement.position,
    tags: placement.chapter.goalSkills.map((row) => row.skill),
  }));
}
