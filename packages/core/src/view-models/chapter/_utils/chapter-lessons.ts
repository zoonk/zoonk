import "server-only";
import { type PlanItem, prisma } from "@zoonk/db";
import { toSummaryIdeas } from "../../../library/lessons/_utils/summary-ideas";
import { type ChapterView } from "../chapter-contract";

type ChapterItem = Pick<PlanItem, "chapterId" | "kind" | "lessonId" | "status">;

type ChapterLessonRow = {
  estimatedMinutes: number;
  id: string;
  skillIds: string[];
  summary: unknown;
  title: string;
};

/** The chapter's lessons in order, each with its skills and summary card. */
export async function loadChapterLessons(chapterId: string): Promise<ChapterLessonRow[]> {
  const rows = await prisma.chapterLesson.findMany({
    orderBy: { position: "asc" },
    select: {
      lesson: {
        select: {
          estimatedMinutes: true,
          id: true,
          skills: { orderBy: { createdAt: "asc" }, select: { skillId: true } },
          summary: true,
          title: true,
        },
      },
    },
    where: { chapterId },
  });

  return rows.map(({ lesson }) => ({
    ...lesson,
    skillIds: lesson.skills.map((skill) => skill.skillId),
  }));
}

/**
 * Whether a lesson is behind the learner: its own plan item is finished, or its chapter's is, or,
 * while the chapter is still ahead, the learner has studied every skill it teaches (how sessions
 * pick a chapter's next lesson).
 */
function isLessonDone({
  chapterItem,
  lesson,
  lessonItem,
  studied,
}: {
  chapterItem: ChapterItem | undefined;
  lesson: ChapterLessonRow;
  lessonItem: ChapterItem | undefined;
  studied: ReadonlySet<string>;
}): boolean {
  if (lessonItem) {
    return lessonItem.status !== "todo";
  }

  if (chapterItem && chapterItem.status !== "todo") {
    return true;
  }

  return lesson.skillIds.length > 0 && lesson.skillIds.every((skillId) => studied.has(skillId));
}

function getLessonState({ isDone, isNext }: { isDone: boolean; isNext: boolean }) {
  if (isDone) {
    return "done" as const;
  }

  return isNext ? ("next" as const) : ("upcoming" as const);
}

/**
 * The plan's lessons in the chapter with their state. A chapter item brings every lesson of the
 * chapter; otherwise only the lessons the plan picked. The next lesson is the first not done.
 */
export function buildChapterLessons({
  chapterId,
  items,
  lessons,
  studied,
}: {
  chapterId: string;
  items: readonly ChapterItem[];
  lessons: readonly ChapterLessonRow[];
  studied: ReadonlySet<string>;
}): ChapterView["lessons"] {
  const chapterItem = items.find((item) => item.kind === "chapter" && item.chapterId === chapterId);

  const lessonItems = new Map(
    items.flatMap((item) => (item.lessonId ? [[item.lessonId, item]] : [])),
  );

  const planned = lessons.filter((lesson) => chapterItem || lessonItems.has(lesson.id));

  const done = planned.map((lesson) =>
    isLessonDone({ chapterItem, lesson, lessonItem: lessonItems.get(lesson.id), studied }),
  );

  const nextIndex = done.indexOf(false);

  return planned.map((lesson, index) => ({
    lessonId: lesson.id,
    minutes: lesson.estimatedMinutes,
    skillIds: lesson.skillIds,
    state: getLessonState({ isDone: done[index] ?? false, isNext: index === nextIndex }),
    title: lesson.title,
  }));
}

/** Every finished lesson leaves its summary card: each idea in one sentence. */
export function buildChapterSummaries({
  lessons,
  states,
}: {
  lessons: readonly ChapterLessonRow[];
  states: ChapterView["lessons"];
}): ChapterView["summaries"] {
  const finished = new Set(
    states.filter((lesson) => lesson.state === "done").map((lesson) => lesson.lessonId),
  );

  return lessons.flatMap((lesson) => {
    const ideas = finished.has(lesson.id) ? toSummaryIdeas(lesson.summary) : [];
    return ideas.length > 0 ? [{ ideas, lessonId: lesson.id, title: lesson.title }] : [];
  });
}
