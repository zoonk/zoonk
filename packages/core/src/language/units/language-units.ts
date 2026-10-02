import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";

/** A lesson of a unit, with whether the learner's plan has it done. */
type LanguageUnitLesson = {
  completedAt: Date | null;
  done: boolean;
  lessonId: string;
  title: string;
};

/**
 * A unit of a language course: one real situation ("Renting an apartment") with its "I can"
 * objectives and lessons, in the course's order.
 */
export type LanguageUnit = {
  chapterId: string;
  description: string;
  level: CourseLevel;
  lessons: LanguageUnitLesson[];
  objectives: string[];
  position: number;
  title: string;
};

const DONE_STATUSES = new Set(["done", "testedOut"]);

/** When each plan lesson the learner finished or tested out of was checked off. */
async function loadDoneLessons(goalId: string): Promise<Map<string, Date | null>> {
  const items = await prisma.planItem.findMany({
    select: { completedAt: true, lessonId: true, status: true },
    where: { lessonId: { not: null }, plan: { goalId } },
  });

  return new Map(
    items.flatMap((item) =>
      item.lessonId && DONE_STATUSES.has(item.status) ? [[item.lessonId, item.completedAt]] : [],
    ),
  );
}

/**
 * The units of a language goal's course, in teaching order, each with its lessons marked done from
 * the learner's plan. Empty until the goal has a course.
 */
export async function loadLanguageUnits(goal: {
  id: string;
  primaryCourseId: string | null;
}): Promise<LanguageUnit[]> {
  if (!goal.primaryCourseId) {
    return [];
  }

  const [placements, done] = await Promise.all([
    prisma.courseChapter.findMany({
      include: {
        chapter: {
          include: {
            lessons: {
              include: { lesson: { select: { id: true, title: true } } },
              orderBy: { position: "asc" },
            },
          },
        },
      },
      orderBy: [{ level: "asc" }, { position: "asc" }],
      where: { courseId: goal.primaryCourseId },
    }),
    loadDoneLessons(goal.id),
  ]);

  return placements.map(({ chapter }, index) => ({
    chapterId: chapter.id,
    description: chapter.description,
    lessons: chapter.lessons.map(({ lesson }) => ({
      completedAt: done.get(lesson.id) ?? null,
      done: done.has(lesson.id),
      lessonId: lesson.id,
      title: lesson.title,
    })),
    level: chapter.level,
    objectives: chapter.objectives,
    position: index + 1,
    title: chapter.title,
  }));
}

/** A unit is finished when every lesson in it is done. */
export function isUnitFinished(unit: LanguageUnit): boolean {
  return unit.lessons.length > 0 && unit.lessons.every((lesson) => lesson.done);
}

/**
 * The unit the learner is in, the same on Today, Progress and a checkpoint: the first one they
 * can't do yet (see `loadDoneUnitIds`), or the last one when they can do them all.
 */
export function findCurrentUnit({
  doneIds,
  units,
}: {
  doneIds: ReadonlySet<string>;
  units: readonly LanguageUnit[];
}): LanguageUnit | null {
  return units.find((unit) => !doneIds.has(unit.chapterId)) ?? units.at(-1) ?? null;
}

/** When a finished unit's last lesson was checked off; null while it's still open. */
export function getUnitFinishedAt(unit: LanguageUnit): Date | null {
  if (!isUnitFinished(unit)) {
    return null;
  }

  const times = unit.lessons.flatMap((lesson) => lesson.completedAt?.getTime() ?? []);
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}
