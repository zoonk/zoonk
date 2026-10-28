import "server-only";
import { type CourseFormat, type CourseLevel, type GenerationStatus, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { type CourseOutlineChapter } from "./course-plan-graph";
import { getExamCourseSkills } from "./exam-course-skills";

export async function loadCourseOutline({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string | null;
}): Promise<CourseOutlineChapter[]> {
  const visible = libraryRowsVisibleTo(userId);

  const placements = await prisma.courseChapter.findMany({
    include: {
      chapter: {
        select: {
          goalSkills: {
            orderBy: { createdAt: "asc" },
            select: { skill: { select: { id: true, name: true } } },
            where: { skill: visible },
          },
          lessons: {
            orderBy: { position: "asc" },
            select: {
              lesson: {
                select: {
                  id: true,
                  skills: {
                    orderBy: { createdAt: "asc" },
                    select: { skill: { select: { id: true, name: true } } },
                    where: { skill: visible },
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
    area: placement.area,
    chapterId: placement.chapterId,
    lessonIds: placement.chapter.lessons.map((entry) => entry.lesson.id),
    lessons: placement.chapter.lessons.map((entry) => entry.lesson.skills.map((row) => row.skill)),
    level: placement.level,
    position: placement.position,
    tags: placement.chapter.goalSkills.map((row) => row.skill),
  }));
}

/** An overview is a shorter course of its own, so it isn't part of the path to mastery. */
const MASTERY_LEVELS: readonly CourseLevel[] = ["beginner", "intermediate", "advanced"];

function isSettledOutline({
  chapters,
  outlineStatus,
}: {
  chapters: readonly Pick<CourseOutlineChapter, "lessonIds">[];
  outlineStatus: GenerationStatus | null;
}): boolean {
  const settled = outlineStatus === null || outlineStatus === "completed";
  return settled && chapters.every((chapter) => chapter.lessonIds.length > 0);
}

function coversEveryLevel({
  chapters,
  outlineStatus,
}: {
  chapters: readonly Pick<CourseOutlineChapter, "lessonIds" | "level">[];
  outlineStatus: GenerationStatus | null;
}): boolean {
  if (!isSettledOutline({ chapters, outlineStatus })) {
    return false;
  }

  const levels = new Set(chapters.map((chapter) => chapter.level));
  return MASTERY_LEVELS.every((level) => levels.has(level));
}

function coversExamSkills({
  chapters,
  courseFormat,
  courseId,
  examGraph,
  outlineStatus,
}: {
  chapters: readonly Pick<CourseOutlineChapter, "lessonIds" | "lessons" | "level" | "tags">[];
  courseFormat: CourseFormat;
  courseId: string;
  examGraph: PlanGraph;
  outlineStatus: GenerationStatus | null;
}): boolean {
  const examSkills = getExamCourseSkills({
    course: { format: courseFormat, id: courseId },
    examGraph,
  });

  if (examSkills.length === 0) {
    return coversEveryLevel({ chapters, outlineStatus });
  }

  if (!isSettledOutline({ chapters, outlineStatus })) {
    return false;
  }

  const taught = new Set(
    chapters.flatMap((chapter) =>
      [...chapter.lessons.flat(), ...chapter.tags].map((skill) => skill.id),
    ),
  );

  return examSkills.every((skill) => taught.has(skill.skillId));
}

export function plansFromCourseOutline({
  chapterId,
  chapters,
  courseFormat,
  courseId,
  examGraph,
  outlineStatus,
}: {
  chapterId: string | null;
  chapters: readonly CourseOutlineChapter[];
  courseFormat: CourseFormat;
  courseId: string;
  examGraph: PlanGraph | null;
  outlineStatus: GenerationStatus | null;
}): boolean {
  if (chapterId) {
    return true;
  }

  return examGraph
    ? coversExamSkills({ chapters, courseFormat, courseId, examGraph, outlineStatus })
    : coversEveryLevel({ chapters, outlineStatus });
}
