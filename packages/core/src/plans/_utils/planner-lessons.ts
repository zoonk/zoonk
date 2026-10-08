import "server-only";
import { type CourseLevel, type Goal, prisma } from "@zoonk/db";
import { getOwnLevel } from "../../learner/placement/placement-contract";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { needsTool } from "../../library/chapters/chapter-tools";
import {
  compareCourseOrder,
  getCourseOrder,
  loadChapterTaughtLessons,
  mergePlannerLessons,
} from "../../library/curriculum/chapter-taught-lessons";
import { type PlanGraph } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";
import { getLevelFloor, keepLevelBands } from "./level-bands";
import { goalUsesTools } from "./plan-tools";
import { type SkillCourses, getSkillCourses, pickSkillPlaces } from "./skill-courses";

/**
 * The Library lessons that teach the plan's skills, in course order (level band, chapter, then
 * lesson), so a skill taught in several chapters meets them in the course's order. A skill with
 * courses only takes lessons its courses' chapters hold, planned in one of those chapters.
 * Private lessons count only for their owner, so one learner's private course never shows up in
 * another's plan.
 */
async function loadLessons({
  skillCourses,
  skillIds,
  userId,
  withToolChapters,
}: {
  skillCourses: SkillCourses;
  skillIds: string[];
  userId: string;
  /** False for an exam answered without tools: lessons only chapters that need one hold stay out. */
  withToolChapters: boolean;
}): Promise<PlannerLesson[]> {
  const rows = await prisma.lessonSkill.findMany({
    select: {
      lesson: {
        select: {
          chapters: {
            select: {
              chapter: {
                select: {
                  courses: {
                    orderBy: { createdAt: "asc" },
                    select: { courseId: true, level: true, position: true },
                  },
                  tools: true,
                },
              },
              chapterId: true,
              position: true,
            },
          },
          createdAt: true,
          estimatedMinutes: true,
          homeChapterId: true,
          id: true,
          title: true,
        },
      },
      skillId: true,
    },
    where: {
      // A lesson set aside after its last held-back draft can't be taught: plans leave it out.
      lesson: { ...libraryRowsVisibleTo(userId), setAsideAt: null },
      skillId: { in: skillIds },
    },
  });

  const taught = rows.flatMap((row) => {
    const places = withToolChapters
      ? row.lesson.chapters
      : row.lesson.chapters.filter((entry) => !needsTool(entry.chapter.tools));

    // A lesson only chapters that need a tool hold isn't planned without them.
    if (places.length === 0 && row.lesson.chapters.length > 0) {
      return [];
    }

    const chapters = pickSkillPlaces({
      getCourseIds: (entry) => entry.chapter.courses.map((placement) => placement.courseId),
      places,
      skillCourses,
      skillId: row.skillId,
    });

    return chapters ? [{ ...row, chapters }] : [];
  });

  const lessons = new Map(taught.map((row) => [row.lesson.id, row]));

  return [...lessons.values()]
    .map(({ chapters, lesson, skillId }) => {
      const chapter =
        chapters.find((entry) => entry.chapterId === lesson.homeChapterId) ?? chapters[0];

      const courses = skillCourses.get(skillId);

      const placement =
        chapter?.chapter.courses.find((entry) => !courses || courses.includes(entry.courseId)) ??
        chapter?.chapter.courses[0];

      return {
        band: placement?.level ?? null,
        chapterId: chapter?.chapterId ?? lesson.homeChapterId,
        createdAt: lesson.createdAt,
        lessonId: lesson.id,
        minutes: lesson.estimatedMinutes,
        order: getCourseOrder({ lessonPosition: chapter?.position ?? 0, placement }),
        skillIds: taught.filter((row) => row.lesson.id === lesson.id).map((row) => row.skillId),
        title: lesson.title,
      };
    })
    .toSorted(
      (a, b) =>
        compareCourseOrder(a.order, b.order) || a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .map(({ band, chapterId, lessonId, minutes, skillIds: taughtIds, title }) => ({
      band,
      chapterId,
      lessonId,
      minutes,
      skillIds: taughtIds,
      title,
    }));
}

/**
 * The Library lessons a plan turns these skills into: the lessons that teach each one, and the
 * lessons of the chapters a course outline tagged with it (a graph skill that spans several
 * lessons), in course order. With the learner's level (`levelFloor`), a skill also taught at it
 * leaves its easier bands out (`keepLevelBands`).
 */
export async function loadSkillLessons({
  goal,
  levelFloor = null,
  skillCourses = new Map(),
  skillIds,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  /** The band the learner's level starts at (`getLevelFloor`); null takes every band. */
  levelFloor?: CourseLevel | null;
  /** The courses the goal learns its skills in; skills left out take lessons from any course. */
  skillCourses?: SkillCourses;
  skillIds: string[];
  userId: string;
}): Promise<PlannerLesson[]> {
  const withToolChapters = await goalUsesTools(goal);

  const [taught, chapterTaught] = await Promise.all([
    loadLessons({ skillCourses, skillIds, userId, withToolChapters }),
    loadChapterTaughtLessons({
      skillCourses,
      skillIds,
      userId,
      withChallenges: goal.kind === "learn",
      withToolChapters,
    }),
  ]);

  return keepLevelBands({
    floor: levelFloor,
    lessons: mergePlannerLessons({ chapterTaught, taught }),
  });
}

/**
 * A skill the graph lists no course for (a prerequisite a change added, a setup skill, a plan made
 * before its courses were known) learns from the goal's own course when that course teaches it, so
 * its lessons don't come from every subject sharing the skill ("Lei de Ohm" from a Physics, an
 * Electricity and an ENEM course in one plan). Skills that course doesn't teach take any course.
 */
async function withGoalCourse({
  primaryCourseId,
  skillCourses,
  skillIds,
  userId,
}: {
  primaryCourseId: string | null;
  skillCourses: SkillCourses;
  skillIds: string[];
  userId: string;
}): Promise<SkillCourses> {
  const unlisted = skillIds.filter((skillId) => !skillCourses.has(skillId));

  if (!primaryCourseId || unlisted.length === 0) {
    return skillCourses;
  }

  const visible = libraryRowsVisibleTo(userId);
  const inCourse = { ...visible, courses: { some: { courseId: primaryCourseId } } };

  const [byLesson, byChapter] = await Promise.all([
    prisma.lessonSkill.findMany({
      distinct: ["skillId"],
      select: { skillId: true },
      where: {
        lesson: { ...visible, chapters: { some: { chapter: inCourse } }, setAsideAt: null },
        skillId: { in: unlisted },
      },
    }),
    prisma.chapterSkill.findMany({
      distinct: ["skillId"],
      select: { skillId: true },
      where: { chapter: inCourse, skillId: { in: unlisted } },
    }),
  ]);

  const taught = [...new Set([...byLesson, ...byChapter].map((row) => row.skillId))];

  return new Map([
    ...skillCourses,
    ...taught.map((skillId) => [skillId, [primaryCourseId]] as const),
  ]);
}

/**
 * The Library lessons a goal's plan turns its graph into, from the courses it learns each skill in,
 * at the learner's level: the lessons the planner plans and its stand-ins count against.
 */
export async function loadGoalPlannerLessons({
  goal,
  graph,
  userId,
}: {
  goal: Pick<Goal, "details" | "examBlueprintId" | "kind" | "primaryCourseId">;
  graph: PlanGraph;
  userId: string;
}): Promise<PlannerLesson[]> {
  const skillIds = graph.skills.map((skill) => skill.skillId);

  const skillCourses = await withGoalCourse({
    primaryCourseId: goal.primaryCourseId,
    skillCourses: getSkillCourses(graph),
    skillIds,
    userId,
  });

  return loadSkillLessons({
    goal,
    levelFloor: getLevelFloor(getOwnLevel({ goal })),
    skillCourses,
    skillIds,
    userId,
  });
}
