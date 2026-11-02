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

async function loadLessons({
  skillCourses,
  skillIds,
  userId,
  withToolChapters,
}: {
  skillCourses: SkillCourses;
  skillIds: string[];
  userId: string | null;
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
      lesson: { ...libraryRowsVisibleTo(userId), NOT: QUICK_LESSON_KEY_WHERE, setAsideAt: null },
      skillId: { in: skillIds },
    },
  });

  const taught = rows.flatMap((row) => {
    const places = withToolChapters
      ? row.lesson.chapters
      : row.lesson.chapters.filter((entry) => !needsTool(entry.chapter.tools));

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

export async function loadSkillLessons({
  goal,
  skillCourses = new Map(),
  skillIds,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind">;
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

  const source = graph.courseOutline;

  const originalSkills = graph.skills.filter((skill) =>
    skill.courseIds?.includes(goal.primaryCourseId ?? ""),
  );

  const outlinedPrimaryCourse =
    originalSkills.length > 0 && originalSkills.every((skill) => skill.outlined);

  if (!source && ((!start && !courseChapters) || !outlinedPrimaryCourse)) {
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
