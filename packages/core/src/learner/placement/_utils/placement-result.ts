import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { nextPlanLessonQuery } from "../../../plans/_utils/next-plan-lesson";
import { parsePlanChangePayload } from "../../../plans/_utils/plan-change-payload";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { placementPartReceipt } from "../../../plans/_utils/test-out-receipt";
import { isWorkFinished } from "../../../plans/_utils/work-progress";
import { parsePlanPhases } from "../../../plans/planner/plan-state";
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

const phaseOrder = [{ phase: "asc" }, { position: "asc" }, { id: "asc" }] as const;

async function readCourseLesson(
  where: { id: string } | ReturnType<typeof nextPlanLessonQuery>["where"],
  tx: TransactionClient,
) {
  const item = await tx.planItem.findFirst({
    orderBy: [...phaseOrder],
    select: {
      chapter: { select: { title: true } },
      lesson: {
        select: {
          estimatedMinutes: true,
          homeChapter: { select: { title: true } },
          id: true,
          title: true,
        },
      },
    },
    where,
  });

  if (!item?.lesson) {
    return null;
  }

  const { homeChapter, ...lesson } = item.lesson;
  return { ...lesson, chapter: item.chapter?.title ?? homeChapter?.title ?? null };
}

export function readPlacementNextLesson(goalId: string, tx: TransactionClient) {
  return readCourseLesson(nextPlanLessonQuery(goalId).where, tx);
}

export async function readPlacementCourse(
  goalId: string,
  startedPastItems: ReadonlySet<string>,
  tx: TransactionClient,
) {
  const plan = await tx.plan.findUnique({
    select: {
      items: {
        orderBy: [...phaseOrder],
        select: {
          chapterId: true,
          id: true,
          kind: true,
          lessonId: true,
          lessons: true,
          phase: true,
          skillId: true,
          status: true,
        },
        where: { kind: "lesson" },
      },
      phases: true,
    },
    where: { goalId },
  });

  if (!plan?.items.length) {
    return { chapter: null, course: null, nextLesson: null };
  }

  const phases = parsePlanPhases(plan.phases);

  if (phases.length === 0) {
    return { chapter: null, course: null, nextLesson: null };
  }

  const groups = Map.groupBy(plan.items, (item) => item.phase);
  const next = plan.items.find((item) => item.status === "todo");

  const chapters = phases.map((_, index) => {
    const group = groups.get(index) ?? [];
    const finished = group.filter((row) => isWorkFinished(row.status));

    const skipped = countLessons(
      finished.filter((row) => row.status === "testedOut" && startedPastItems.has(row.id)),
    );

    return {
      done: countLessons(finished) - skipped,
      lessons: countLessons(group),
      skipped,
      start: index === next?.phase,
    };
  });

  return {
    chapter: next ? phases[next.phase]?.name || null : null,
    course: { chapters, lessons: chapters.reduce((sum, phase) => sum + phase.lessons, 0) },
    nextLesson: next?.lessonId ? await readCourseLesson({ id: next.id }, tx) : null,
  };
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

  const { chapter, course, nextLesson } = await readPlacementCourse(
    goalId,
    new Set(payload.planItemIds),
    db,
  );

  const lessonsSkipped = course?.chapters.reduce((total, phase) => total + phase.skipped, 0) ?? 0;

  return {
    attemptId: result.attemptId,
    changeId: change?.id ?? null,
    chapter: course ? chapter : result.chapter,
    course,
    finish: result.finish,
    finishedAt: result.finishedAt,
    heldUntilTomorrow: result.heldUntilTomorrow,
    lessonsSkipped,
    nextLesson,
  };
}
