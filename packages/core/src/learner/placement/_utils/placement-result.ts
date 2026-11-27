import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { findPlanFirstLessonId } from "../../../plans/_utils/plan-first-lesson";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { countItemLessons } from "../../../plans/_utils/stand-in-lessons";
import { placementPartReceipt } from "../../../plans/_utils/test-out-receipt";
import { type PlacementRecord } from "./placement-attempt-record";

export async function readPlacementNextLesson(goalId: string, tx: TransactionClient) {
  const lessonId = await findPlanFirstLessonId({ db: tx, goalId });
  if (!lessonId) return null;
  const lesson = await tx.lesson.findUnique({
    select: {
      id: true,
      title: true,
      estimatedMinutes: true,
      homeChapter: { select: { title: true } },
    },
    where: { id: lessonId },
  });
  return (
    lesson && {
      id: lesson.id,
      title: lesson.title,
      estimatedMinutes: lesson.estimatedMinutes,
      chapter: lesson.homeChapter?.title ?? null,
    }
  );
}

export async function readPlacementCourse(
  goalId: string,
  startedPastItems: ReadonlySet<string>,
  tx: TransactionClient,
) {
  const rows = await tx.planItem.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      id: true,
      position: true,
      status: true,
      kind: true,
      chapterId: true,
      lessonId: true,
      lessons: true,
      skillId: true,
      lesson: { select: { homeChapterId: true } },
    },
    where: { kind: "lesson", plan: { goalId } },
  });
  if (!rows.length) return null;
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
  if (!result) return null;
  const saved = result.nextLesson;
  const nextLesson =
    saved && saved.estimatedMinutes !== undefined
      ? { ...saved, estimatedMinutes: saved.estimatedMinutes, chapter: saved.chapter ?? null }
      : await readPlacementNextLesson(goalId, tx ?? prisma);
  const view = {
    attemptId: result.attemptId,
    chapter: result.chapter,
    changeId: result.changeId,
    course: result.course,
    finish: result.finish,
    finishedAt: result.finishedAt,
    heldUntilTomorrow: result.heldUntilTomorrow,
    lessonsSkipped: result.lessonsSkipped,
    nextLesson,
  };
  if (!latest) return view;
  const stoppedAt = latest.finish?.end === "stopped" ? latest.finish.answered : undefined;
  const receipt = placementPartReceipt(result.attemptId, latest.part, stoppedAt);
  const change =
    result.lessonsSkipped > 0 ? await readTestOutChange({ db: tx, goalId, receipt }) : null;
  return { ...view, changeId: change?.id ?? null };
}
