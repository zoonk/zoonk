import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { countItemLessons } from "../../../plans/_utils/stand-in-lessons";
import { placementPartReceipt } from "../../../plans/_utils/test-out-receipt";
import { type PlacementRecord } from "./placement-attempt-record";

export async function readPlacementNextLesson(goalId: string, tx: TransactionClient) {
  const item = await tx.planItem.findFirst({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      chapterId: true,
      lesson: {
        select: {
          estimatedMinutes: true,
          homeChapter: { select: { id: true, title: true } },
          id: true,
          title: true,
        },
      },
    },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  const lesson = item?.lesson ?? null;

  if (!lesson) {
    return null;
  }

  const chapter =
    item?.chapterId && item.chapterId !== lesson.homeChapter?.id
      ? await tx.chapter.findUnique({ select: { title: true }, where: { id: item.chapterId } })
      : lesson.homeChapter;

  return {
    chapter: chapter?.title ?? lesson.homeChapter?.title ?? null,
    estimatedMinutes: lesson.estimatedMinutes,
    id: lesson.id,
    title: lesson.title,
  };
}

export async function readPlacementCourse(
  goalId: string,
  startedPastItems: ReadonlySet<string>,
  tx: TransactionClient,
) {
  const rows = await tx.planItem.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      chapterId: true,
      id: true,
      kind: true,
      lesson: { select: { homeChapterId: true } },
      lessonId: true,
      lessons: true,
      position: true,
      skillId: true,
      status: true,
    },
    where: { kind: "lesson", plan: { goalId } },
  });

  if (rows.length === 0) {
    return null;
  }

  const next = rows.find((row) => row.status === "todo");

  const chapters = [
    ...Map.groupBy(
      rows,
      (row) => row.chapterId ?? row.lesson?.homeChapterId ?? row.skillId,
    ).values(),
  ].map((group) => ({
    lessons: group.reduce((total, row) => total + countItemLessons(row), 0),
    skipped: group.reduce(
      (total, row) => total + (startedPastItems.has(row.id) ? countItemLessons(row) : 0),
      0,
    ),
    start: next !== undefined && group.includes(next),
  }));

  return { chapters, lessons: chapters.reduce((total, chapter) => total + chapter.lessons, 0) };
}

export async function readPlacementResult({
  goalId,
  placement,
  tx,
}: {
  goalId: string;
  placement: PlacementRecord | null;
  tx?: TransactionClient;
}) {
  const result = placement?.result ?? null;
  const latest = placement?.finishedParts.at(-1);

  if (!result) {
    return null;
  }

  const saved = result.nextLesson;

  let nextLesson = null;

  if (!result.startedPastSkillIds || result.course) {
    nextLesson =
      saved && saved.estimatedMinutes !== undefined
        ? { ...saved, chapter: saved.chapter ?? null, estimatedMinutes: saved.estimatedMinutes }
        : await readPlacementNextLesson(goalId, tx ?? prisma);
  }

  const view = {
    attemptId: result.attemptId,
    changeId: result.changeId,
    chapter: result.chapter,
    course: result.course,
    finish: result.finish,
    finishedAt: result.finishedAt,
    heldUntilTomorrow: result.heldUntilTomorrow,
    lessonsSkipped: result.lessonsSkipped,
    nextLesson,
  };

  if (!latest) {
    return view;
  }

  const stoppedAt = latest.finish?.end === "stopped" ? latest.finish.answered : undefined;
  const receipt = placementPartReceipt(result.attemptId, latest.part, stoppedAt);

  const change =
    result.lessonsSkipped > 0 || result.startedPastSkillIds?.length
      ? await readTestOutChange({ db: tx, goalId, receipt })
      : null;

  return { ...view, changeId: change?.id ?? null };
}
