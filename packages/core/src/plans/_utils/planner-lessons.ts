import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { loadCourseOutline } from "../../goals/_utils/course-outline";
import { type CourseOutlineChapter } from "../../goals/_utils/course-plan-graph";
import { readCourseStart } from "../../goals/course-start-details";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { needsTool } from "../../library/chapters/chapter-tools";
import {
  compareCourseOrder,
  getCourseOrder,
  loadChapterTaughtLessons,
  mergePlannerLessons,
} from "../../library/curriculum/chapter-taught-lessons";
import { QUICK_LESSON_KEY_WHERE } from "../../library/quick-lessons/quick-lesson-identity";
import { type PlanGraph } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";
import { withCourseLessonOrder } from "./course-lesson-order";
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
  userId: string | null;
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
            where: { chapter: libraryRowsVisibleTo(userId) },
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
      // A lesson set aside after its last held-back draft can't be taught: plans leave it out. A
      // skill's quick lesson isn't one of its lessons: plans place it only where a learner chose it.
      lesson: { ...libraryRowsVisibleTo(userId), NOT: QUICK_LESSON_KEY_WHERE, setAsideAt: null },
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
        compareCourseOrder(a.order, b.order) ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.lessonId.localeCompare(b.lessonId),
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
 * lessons), in course order, every band included: the level a learner states only leaves its
 * easier bands to confirm, and placement answers of a skill's own test them out.
 */
export async function loadSkillLessons({
  goal,
  skillCourses = new Map(),
  skillIds,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind">;
  /** The courses the goal learns its skills in; skills left out take lessons from any course. */
  skillCourses?: SkillCourses;
  skillIds: string[];
  userId: string | null;
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

  return mergePlannerLessons({ chapterTaught, taught });
}

/**
 * A skill the graph lists no course for (a prerequisite a change added, a setup skill, a plan made
 * before its courses were known) learns from the goal's own course when that course teaches it, so
 * its lessons don't come from every subject sharing the skill ("Ohm's law" from a Physics, an
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
  userId: string | null;
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
 * The Library lessons a goal's plan turns its graph into, from the courses it learns each skill in:
 * the lessons the planner plans and its stand-ins count against.
 */
export async function loadGoalPlannerLessons({
  courseChapters,
  goal,
  graph,
  userId,
}: {
  courseChapters?: readonly CourseOutlineChapter[];
  goal: Pick<Goal, "examBlueprintId" | "kind" | "primaryCourseId"> & Partial<Pick<Goal, "details">>;
  graph: PlanGraph;
  userId: string | null;
}): Promise<PlannerLesson[]> {
  const skillIds = graph.skills.map((skill) => skill.skillId);

  const skillCourses = await withGoalCourse({
    primaryCourseId: goal.primaryCourseId,
    skillCourses: getSkillCourses(graph),
    skillIds,
    userId,
  });

  const lessons = await loadSkillLessons({ goal, skillCourses, skillIds, userId });
  const start = readCourseStart(isJsonObject(goal.details) ? goal.details : {});

  /** Skill-graph curricula keep their own phases until they plan from a settled course outline. */
  const source = graph.courseOutline;

  const originalSkills = graph.skills.filter((skill) =>
    skill.courseIds?.includes(goal.primaryCourseId ?? ""),
  );

  const legacyOutline =
    originalSkills.length > 0 && originalSkills.every((skill) => skill.outlined);

  if (!source && ((!start && !courseChapters) || !legacyOutline)) {
    return lessons;
  }

  const sourceCourseId = source?.courseId ?? goal.primaryCourseId;

  const chapters =
    courseChapters ??
    (sourceCourseId ? await loadCourseOutline({ courseId: sourceCourseId, userId }) : []);

  return withCourseLessonOrder({
    chapters,
    lessons,
    levels: source?.levels,
    startChapterId: source?.startChapterId ?? start?.chapterId ?? null,
  });
}
