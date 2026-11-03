import "server-only";
import { CourseLevel, prisma } from "@zoonk/db";
import { type SkillCourses, pickSkillPlaces } from "../../plans/_utils/skill-courses";
import { type PlannerLesson } from "../../plans/planner/plan-units";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { isChallengeIdentityKey } from "../challenges/challenge-lesson-spec";
import { needsTool } from "../chapters/chapter-tools";

const LEVEL_RANK = new Map(Object.values(CourseLevel).map((level, index) => [level, index]));

const UNPLACED = Number.MAX_SAFE_INTEGER;

export type CourseOrder = readonly [number, number, number];

export function getCourseOrder({
  lessonPosition,
  placement,
}: {
  lessonPosition: number;
  placement: { level: CourseLevel; position: number } | undefined;
}): CourseOrder {
  const band = placement ? (LEVEL_RANK.get(placement.level) ?? UNPLACED) : UNPLACED;
  return [band, placement?.position ?? UNPLACED, lessonPosition];
}

export function compareCourseOrder(a: CourseOrder, b: CourseOrder): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export type CourseOrderedLesson = PlannerLesson & { order: CourseOrder };

type ChapterTaughtLesson = CourseOrderedLesson & { chapterId: string };

export async function loadChapterTaughtLessons({
  skillCourses = new Map(),
  skillIds,
  userId,
  withChallenges,
  withToolChapters,
}: {
  skillCourses?: SkillCourses;
  skillIds: readonly string[];
  userId: string | null;
  withChallenges: boolean;
  withToolChapters: boolean;
}): Promise<ChapterTaughtLesson[]> {
  const visible = libraryRowsVisibleTo(userId);

  const rows = await prisma.chapterSkill.findMany({
    select: {
      chapter: {
        select: {
          courses: {
            orderBy: { createdAt: "asc" },
            select: { courseId: true, level: true, position: true },
          },
          id: true,
          lessons: {
            orderBy: { position: "asc" },
            select: {
              lesson: {
                select: { estimatedMinutes: true, id: true, identityKey: true, title: true },
              },
              position: true,
            },
            where: { lesson: { ...visible, setAsideAt: null } },
          },
          tools: true,
        },
      },
      skillId: true,
    },
    where: { chapter: visible, skillId: { in: [...skillIds] } },
  });

  const planned = withToolChapters ? rows : rows.filter((row) => !needsTool(row.chapter.tools));

  const lessons = planned.flatMap((row) => {
    const placements = pickSkillPlaces({
      getCourseIds: (placement) => [placement.courseId],
      places: row.chapter.courses,
      skillCourses,
      skillId: row.skillId,
    });

    if (!placements) {
      return [];
    }

    const [placement] = placements;

    const chapterLessons = withChallenges
      ? row.chapter.lessons
      : row.chapter.lessons.filter((entry) => !isChallengeIdentityKey(entry.lesson.identityKey));

    return chapterLessons.map((entry): ChapterTaughtLesson => ({
      band: placement?.level ?? null,
      chapterId: row.chapter.id,
      lessonId: entry.lesson.id,
      minutes: entry.lesson.estimatedMinutes,
      order: getCourseOrder({ lessonPosition: entry.position, placement }),
      skillIds: [row.skillId],
      title: entry.lesson.title,
    }));
  });

  return lessons.toSorted(
    (a, b) =>
      compareCourseOrder(a.order, b.order) ||
      a.chapterId.localeCompare(b.chapterId) ||
      a.lessonId.localeCompare(b.lessonId),
  );
}

export function mergePlannerLessons({
  chapterTaught,
  taught,
}: {
  chapterTaught: readonly CourseOrderedLesson[];
  taught: readonly CourseOrderedLesson[];
}): PlannerLesson[] {
  const taggedPlaces = new Map<string, CourseOrderedLesson>();

  for (const lesson of chapterTaught) {
    if (!taggedPlaces.has(lesson.lessonId)) {
      taggedPlaces.set(lesson.lessonId, lesson);
    }
  }

  const merged = [...taught, ...chapterTaught].reduce((byId, lesson) => {
    const existing = byId.get(lesson.lessonId);
    const place = taggedPlaces.get(lesson.lessonId) ?? lesson;

    return byId.set(
      lesson.lessonId,
      existing
        ? { ...existing, skillIds: [...new Set([...existing.skillIds, ...lesson.skillIds])] }
        : { ...lesson, chapterId: place.chapterId, order: place.order },
    );
  }, new Map<string, CourseOrderedLesson>());

  return [...merged.values()]
    .toSorted((a, b) => compareCourseOrder(a.order, b.order))
    .map(({ order: _order, ...lesson }) => lesson);
}
