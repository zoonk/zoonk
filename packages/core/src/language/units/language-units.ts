import "server-only";
import { type CourseLevel, type PlanItem, prisma } from "@zoonk/db";

type LanguageUnitLesson = {
  completedAt: Date | null;
  done: boolean;
  lessonId: string;
  title: string;
};

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

type PlanUnitItem = Pick<PlanItem, "chapterId" | "completedAt" | "lessonId" | "status">;

function getDoneLessons(items: readonly PlanUnitItem[]): Map<string, Date | null> {
  return new Map(
    items.flatMap((item) =>
      item.lessonId && DONE_STATUSES.has(item.status) ? [[item.lessonId, item.completedAt]] : [],
    ),
  );
}

export async function loadLanguageUnits(goal: { id: string }): Promise<LanguageUnit[]> {
  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { chapterId: true, completedAt: true, lessonId: true, status: true },
    where: { plan: { goalId: goal.id } },
  });

  const chapterIds = [...new Set(items.flatMap((item) => item.chapterId ?? []))];

  const chapters = await prisma.chapter.findMany({
    include: {
      lessons: {
        include: { lesson: { select: { id: true, title: true } } },
        orderBy: { position: "asc" },
      },
    },
    where: { id: { in: chapterIds } },
  });

  const done = getDoneLessons(items);

  return chapterIds
    .flatMap((chapterId) => chapters.find((chapter) => chapter.id === chapterId) ?? [])
    .map((chapter, index) => ({
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

export function isUnitFinished(unit: LanguageUnit): boolean {
  return unit.lessons.length > 0 && unit.lessons.every((lesson) => lesson.done);
}

export function findCurrentUnit({
  doneIds,
  units,
}: {
  doneIds: ReadonlySet<string>;
  units: readonly LanguageUnit[];
}): LanguageUnit | null {
  return units.find((unit) => !doneIds.has(unit.chapterId)) ?? units.at(-1) ?? null;
}
