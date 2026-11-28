import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { nextPlanLessonQuery } from "../../../plans/_utils/next-plan-lesson";
import { parsePlanChangePayload } from "../../../plans/_utils/plan-change-payload";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { placementPartReceipt } from "../../../plans/_utils/test-out-receipt";
import { isWorkFinished } from "../../../plans/_utils/work-progress";
import { type PlacementRecord } from "./placement-attempt-record";

export function readPlacementChange({
  attemptId,
  db,
  finish,
  goalId,
  part = 1,
}: {
  attemptId: string;
  db?: TransactionClient;
  finish: PlacementRecord["finishedParts"][number]["finish"];
  goalId: string;
  part?: number;
}) {
  const stoppedAt = finish?.end === "stopped" ? finish.answered : undefined;

  return readTestOutChange({
    db,
    goalId,
    receipt: placementPartReceipt(attemptId, part, stoppedAt),
  });
}

export async function readPlacementNextLesson(goalId: string, tx: TransactionClient) {
  const item = await tx.planItem.findFirst({
    ...nextPlanLessonQuery(goalId),
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
  ].map((group) => {
    const finished = group.filter((row) => isWorkFinished(row.status));

    const skipped = countLessons(
      finished.filter((row) => row.status === "testedOut" && startedPastItems.has(row.id)),
    );

    return {
      done: countLessons(finished) - skipped,
      lessons: countLessons(group),
      skipped,
      start: next !== undefined && group.includes(next),
    };
  });

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

  if (result.courseStart) {
    return readCourseResult(goalId, result, tx ?? prisma);
  }

  const saved = result.nextLesson;

  const nextLesson =
    saved && saved.estimatedMinutes !== undefined
      ? { ...saved, chapter: saved.chapter ?? null, estimatedMinutes: saved.estimatedMinutes }
      : await readPlacementNextLesson(goalId, tx ?? prisma);

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

  const change =
    result.lessonsSkipped > 0
      ? await readPlacementChange({
          attemptId: result.attemptId,
          db: tx,
          finish: latest.finish,
          goalId,
          part: latest.part,
        })
      : null;

  return { ...view, changeId: change?.id ?? null };
}

async function readCourseResult(
  goalId: string,
  result: NonNullable<PlacementRecord["result"]>,
  db: TransactionClient,
) {
  const change = await readPlacementChange({
    attemptId: result.attemptId,
    db,
    finish: result.finish,
    goalId,
  });

  const payload = parsePlanChangePayload(change?.payload);
  const course = await readPlacementCourse(goalId, new Set(payload.planItemIds), db);
  const nextLesson = course ? await readPlacementNextLesson(goalId, db) : null;

  const lessonsSkipped =
    course?.chapters.reduce((total, chapter) => total + chapter.skipped, 0) ?? 0;

  return {
    attemptId: result.attemptId,
    changeId: change?.id ?? null,
    chapter: nextLesson?.chapter ?? result.chapter,
    course,
    finish: result.finish,
    finishedAt: result.finishedAt,
    heldUntilTomorrow: result.heldUntilTomorrow,
    lessonsSkipped,
    nextLesson,
  };
}
