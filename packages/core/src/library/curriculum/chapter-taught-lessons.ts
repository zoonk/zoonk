import "server-only";
import { CourseLevel, prisma } from "@zoonk/db";
import { type SkillCourses, pickSkillPlaces } from "../../plans/_utils/skill-courses";
import { type PlannerLesson } from "../../plans/planner/plan-units";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { isChallengeIdentityKey } from "../challenges/challenge-lesson-spec";
import { needsTool } from "../chapters/chapter-tools";

const LEVEL_RANK = new Map(Object.values(CourseLevel).map((level, index) => [level, index]));

/** Past any real position, so a chapter no course places yet sorts after the placed ones. */
const UNPLACED = Number.MAX_SAFE_INTEGER;

/** Where a lesson sits in a course: its chapter's level band, the chapter, then the lesson. */
export type CourseOrder = readonly [number, number, number];

/** A lesson's place in the course its chapter is placed in; unplaced chapters come last. */
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

type ChapterTaughtLesson = PlannerLesson & { order: CourseOrder };

/**
 * The lessons of the chapters a course outline tagged with the plan's skills, in course order
 * (level band, chapter, lesson). A goal's skill graph names skills that take several lessons,
 * such as "Solve linear equations"; the outline says which chapters teach each one, so those
 * chapters' lessons are the skill's lessons. A skill with courses only takes chapters its courses
 * place, in that course's order: another subject's outline may tag the same shared skill. Private
 * chapters and lessons count only for their owner.
 */
export async function loadChapterTaughtLessons({
  skillCourses = new Map(),
  skillIds,
  userId,
  withChallenges,
  withToolChapters,
}: {
  /** The courses the goal learns its skills in; skills left out take chapters from any course. */
  skillCourses?: SkillCourses;
  skillIds: readonly string[];
  userId: string;
  /** Chapter challenges are for learn goals; exam and language plans leave them out. */
  withChallenges: boolean;
  /** False for an exam answered without tools: chapters that need one teach beyond it. */
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
            // A lesson set aside after its last held-back draft can't be taught.
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
    .toSorted((a, b) => compareCourseOrder(a.order, b.order))
    .map((lesson) => ({
      band: lesson.band,
      chapterId: lesson.chapterId,
      lessonId: lesson.lessonId,
      minutes: lesson.minutes,
      skillIds: lesson.skillIds,
      title: lesson.title,
    }));
}

/**
 * Joins the lessons that teach a skill directly with the lessons of chapters tagged with it. A
 * lesson found both ways stays where it came first and teaches every skill it was found for, and
 * it's placed in the chapter an outline tagged for the plan's skills: a lesson another course
 * made first (its home chapter) and this plan's course also teaches shows up once, in this plan's
 * chapter, instead of as a one-lesson chapter of the other course next to the same topic.
 */
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
