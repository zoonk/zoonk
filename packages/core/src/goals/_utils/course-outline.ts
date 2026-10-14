import "server-only";
import { type CourseFormat, type CourseLevel, type GenerationStatus, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { type CourseOutlineChapter } from "./course-plan-graph";
import { getExamCourseSkills } from "./exam-course-skills";

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

/**
 * The bands that together are a course's full path to mastery (the course outline's level bands);
 * an overview is a shorter course of its own, which no deeper goal needs.
 */
const MASTERY_LEVELS: readonly CourseLevel[] = ["beginner", "intermediate", "advanced"];

/**
 * Whether the outline is settled and every chapter in it teaches something. A run still writing
 * (or one that failed) leaves a band in part, and a chapter is placed before its lessons are saved,
 * so a chapter without lessons is one whose lessons never landed.
 */
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

/**
 * Whether a course's outline covers every level the course spans, so a plan built from it leaves
 * none out: each band of the path to mastery has chapters, all of them with lessons, and no run is
 * writing or failed one. A course a goal outlined only in part (nearby bands first, later ones as
 * plans get close) isn't: a later learner's plan comes from their own graph, which outlines what's
 * missing.
 */
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

/**
 * Whether an exam course's outline teaches every skill its stored exam graph gives the course
 * (`getExamCourseSkills`), so a plan built from it leaves none of the exam out. The exam, not the
 * course's level bands, says what the course spans; a graph that gives the course no skill proves
 * nothing, so the course's level bands decide then.
 */
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

/**
 * Whether a course start plans from the course's stored outline: a chapter start always does (the
 * learner chose where to begin), and a whole-course start does once the outline covers what the
 * course spans (`coversExamSkills` for a course with a stored exam, `coversEveryLevel` for the
 * rest). Otherwise the goal's first run plans it from its own graph, which outlines what's missing,
 * so nothing (the plan, the course's estimate) is built from an outline that leaves part out.
 */
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
  /** An exam course the exam's graph names nowhere is the whole exam (`getExamCourseSkills`). */
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
