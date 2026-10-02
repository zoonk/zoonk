import "server-only";
import { type Lesson, type PlanItem, prisma } from "@zoonk/db";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { type PlannedLesson } from "../session-builder";

type LessonWithSkills = Lesson & { skills: { skillId: string }[] };

type LearnItem = Pick<PlanItem, "chapterId" | "id" | "kind" | "lessonId" | "titleSnapshot">;

const LESSON_INCLUDE = {
  skills: { orderBy: { createdAt: "asc" }, select: { skillId: true } },
} as const;

function toPlannedLesson({
  item,
  lesson,
}: {
  item: Pick<LearnItem, "chapterId" | "id" | "titleSnapshot"> | null;
  lesson: LessonWithSkills;
}): PlannedLesson {
  return {
    canDo: lesson.canDo,
    chapterId: item?.chapterId ?? lesson.homeChapterId,
    lessonId: lesson.id,
    minutes: lesson.estimatedMinutes || DEFAULT_LESSON_MINUTES,
    planItemId: item?.id ?? null,
    skillIds: lesson.skills.map((skill) => skill.skillId),
    title: lesson.title,
  };
}

/**
 * The chapter's next lesson the learner hasn't studied yet: one with a skill never answered. A
 * lesson set aside after its drafts were held back is passed over.
 */
function findNextChapterLesson({
  chapterLessons,
  studied,
}: {
  chapterLessons: readonly LessonWithSkills[];
  studied: ReadonlySet<string>;
}): LessonWithSkills | null {
  return (
    chapterLessons.find(
      (lesson) =>
        lesson.setAsideAt === null && lesson.skills.some((skill) => !studied.has(skill.skillId)),
    ) ?? null
  );
}

async function loadChapterLessons({
  chapterIds,
  userId,
}: {
  chapterIds: string[];
  userId: string;
}) {
  const rows = await prisma.chapterLesson.findMany({
    include: { lesson: { include: LESSON_INCLUDE } },
    orderBy: { position: "asc" },
    where: { chapterId: { in: chapterIds } },
  });

  const studiedRows = await prisma.learnerSkill.findMany({
    select: { skillId: true },
    where: {
      reps: { gt: 0 },
      skillId: { in: rows.flatMap((row) => row.lesson.skills.map((skill) => skill.skillId)) },
      userId,
    },
  });

  return { rows, studied: new Set(studiedRows.map((row) => row.skillId)) };
}

/**
 * Turns the plan's next learn items into lessons for the session. A lesson item is its lesson; a
 * chapter item is the chapter's next lesson the learner hasn't studied, or the chapter itself when
 * its lessons aren't written yet (they're generated just in time). A chapter with every lesson
 * studied has nothing left to learn today.
 */
export async function loadPlanLessons({
  items,
  userId,
}: {
  items: readonly LearnItem[];
  userId: string;
}): Promise<PlannedLesson[]> {
  const lessonIds = items.flatMap((item) => (item.lessonId ? [item.lessonId] : []));

  const chapterIds = items.flatMap((item) =>
    !item.lessonId && item.chapterId ? [item.chapterId] : [],
  );

  const [lessons, chapters] = await Promise.all([
    prisma.lesson.findMany({
      include: LESSON_INCLUDE,
      where: { id: { in: lessonIds }, setAsideAt: null },
    }),
    loadChapterLessons({ chapterIds, userId }),
  ]);

  return items.flatMap((item): PlannedLesson[] => {
    const lesson = lessons.find((candidate) => candidate.id === item.lessonId);

    if (lesson) {
      return [toPlannedLesson({ item, lesson })];
    }

    // A lesson item whose lesson was deleted, or set aside after its drafts were held back, has
    // nothing to teach: the day moves on to the next item.
    if (!item.chapterId || item.lessonId) {
      return [];
    }

    const chapterLessons = chapters.rows
      .filter((row) => row.chapterId === item.chapterId)
      .map((row) => row.lesson);

    if (chapterLessons.length === 0) {
      return [
        {
          canDo: null,
          chapterId: item.chapterId,
          lessonId: null,
          minutes: DEFAULT_LESSON_MINUTES,
          planItemId: item.id,
          skillIds: [],
          title: item.titleSnapshot,
        },
      ];
    }

    const next = findNextChapterLesson({ chapterLessons, studied: chapters.studied });
    return next ? [toPlannedLesson({ item, lesson: next })] : [];
  });
}

/** Lessons that teach skills, for reinforcement before a boss rematch: one per skill, in order. */
export async function loadLessonsForSkills({
  limit,
  skillIds,
}: {
  limit: number;
  skillIds: readonly string[];
}): Promise<PlannedLesson[]> {
  const rows = await prisma.lessonSkill.findMany({
    include: { lesson: { include: LESSON_INCLUDE } },
    orderBy: { createdAt: "asc" },
    where: { lesson: { setAsideAt: null }, skillId: { in: [...skillIds] } },
  });

  const bySkill = skillIds.flatMap((skillId) => {
    const row = rows.find((candidate) => candidate.skillId === skillId);
    return row ? [row.lesson] : [];
  });

  const unique = bySkill.filter(
    (lesson, index) => bySkill.findIndex((other) => other.id === lesson.id) === index,
  );

  return unique.slice(0, limit).map((lesson) => toPlannedLesson({ item: null, lesson }));
}
