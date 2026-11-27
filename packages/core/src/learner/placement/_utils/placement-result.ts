import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { findPlanFirstLessonId } from "../../../plans/_utils/plan-first-lesson";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { placementPartReceipt } from "../../../plans/_utils/test-out-receipt";
import { type PlacementRecord } from "./placement-attempt-record";

export async function readPlacementNextLesson(goalId: string, tx: TransactionClient) {
  const lessonId = await findPlanFirstLessonId({ db: tx, goalId });

  return lessonId
    ? tx.lesson.findUnique({ select: { id: true, title: true }, where: { id: lessonId } })
    : null;
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

  if (!placement || !result || !latest) {
    return result;
  }

  const part = latest.part;

  const partLessonsSkipped = placement.finishedParts
    .filter((receipt) => receipt.part === part)
    .reduce((count, receipt) => count + receipt.lessonsSkipped, 0);

  const stoppedAt = latest.finish?.end === "stopped" ? latest.finish.answered : undefined;
  const receipt = placementPartReceipt(result.attemptId, part, stoppedAt);

  const change =
    latest.lessonsSkipped > 0 ? await readTestOutChange({ db: tx, goalId, receipt }) : null;

  return { ...result, changeId: change?.id ?? null, part, partLessonsSkipped };
}
