import "server-only";
import { type Lesson, type PlanItem, prisma } from "@zoonk/db";
import { toSummaryIdeas } from "../../../library/lessons/_utils/summary-ideas";
import { isWorkFinished } from "../../../plans/_utils/work-progress";
import { findUpNextLessonId } from "../../_utils/up-next-lesson";
import { type ChapterView } from "../chapter-contract";

type ChapterItem = Pick<PlanItem, "chapterId" | "kind" | "lessonId" | "status">;

type ChapterLessonRow = {
  contentStatus: Lesson["contentStatus"];
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
          contentStatus: true,
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
    return isWorkFinished(lessonItem.status);
  }

  if (chapterItem && isWorkFinished(chapterItem.status)) {
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
 * chapter; otherwise only the lessons the plan picked. The next lesson is the one Today opens
 * next (see `findUpNextLessonId`). One still ahead that the plan holds for Plus is marked so.
 */
export function buildChapterLessons({
  chapterId,
  items,
  lessons,
  plusOnlyLessonIds,
  sessionLessonIds,
  studied,
}: {
  chapterId: string;
  /** The plan's items, in its order. */
  items: readonly ChapterItem[];
  lessons: readonly ChapterLessonRow[];
  /** Lessons a free exam plan past its first week opens with Plus only (`loadPlusOnlyLessonIds`). */
  plusOnlyLessonIds: ReadonlySet<string>;
  /** Today's session's lessons, in the order it opens them (`loadTodayLearnBlocks`). */
  sessionLessonIds: readonly string[];
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

  const nextId = findUpNextLessonId({
    lessons: planned.map((lesson, index) => ({ done: done[index] ?? false, lessonId: lesson.id })),
    planLessonIds: items.flatMap((item) =>
      item.lessonId && item.status === "todo" ? [item.lessonId] : [],
    ),
    sessionLessonIds,
  });

  return planned.map((lesson, index) => ({
    lessonId: lesson.id,
    minutes: lesson.estimatedMinutes,
    plusRequired: !done[index] && plusOnlyLessonIds.has(lesson.id),
    skillIds: lesson.skillIds,
    state: getLessonState({ isDone: done[index] ?? false, isNext: lesson.id === nextId }),
    title: lesson.title,
    written: lesson.contentStatus === "completed",
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
