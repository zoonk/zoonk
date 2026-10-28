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

type ChapterTaughtLesson = PlannerLesson & { chapterId: string; order: CourseOrder };

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
}): Promise<PlannerLesson[]> {
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

  return lessons
    .toSorted(
      (a, b) =>
        compareCourseOrder(a.order, b.order) ||
        a.chapterId.localeCompare(b.chapterId) ||
        a.lessonId.localeCompare(b.lessonId),
    )
    .map((lesson) => ({
      band: lesson.band,
      chapterId: lesson.chapterId,
      lessonId: lesson.lessonId,
      minutes: lesson.minutes,
      skillIds: lesson.skillIds,
      title: lesson.title,
    }));
}

export function mergePlannerLessons({
  chapterTaught,
  taught,
}: {
  chapterTaught: readonly PlannerLesson[];
  taught: readonly PlannerLesson[];
}): PlannerLesson[] {
  const taggedChapters = new Map<string, string | null>();

  for (const lesson of chapterTaught) {
    if (!taggedChapters.has(lesson.lessonId)) {
      taggedChapters.set(lesson.lessonId, lesson.chapterId);
    }
  }

  const merged = [...taught, ...chapterTaught].reduce((byId, lesson) => {
    const existing = byId.get(lesson.lessonId);
    const chapterId = taggedChapters.get(lesson.lessonId) ?? lesson.chapterId;

    return byId.set(
      lesson.lessonId,
      existing
        ? { ...existing, skillIds: [...new Set([...existing.skillIds, ...lesson.skillIds])] }
        : { ...lesson, chapterId },
    );
  }, new Map<string, PlannerLesson>());

  return [...merged.values()];
}
