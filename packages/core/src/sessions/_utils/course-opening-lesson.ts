import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { readPlacementAttempt } from "../../learner/placement/_utils/placement-attempt-record";
import {
  readPlacementChange,
  readPlacementNextLesson,
} from "../../learner/placement/_utils/placement-result";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";

export async function getCourseOpeningLesson({
  goal,
  localDate,
}: {
  goal: Pick<Goal, "details" | "kind" | "id">;
  localDate: Date;
}) {
  if (goal.kind !== "learn") {
    return null;
  }

  const { result } = readPlacementAttempt(goal);

  if (!result?.courseStart) {
    return null;
  }

  const teachingDay = await prisma.studySession.findFirst({
    select: { id: true },
    where: {
      blocks: { some: { kind: "learn" } },
      createdAt: { gte: new Date(result.finishedAt) },
      goalId: goal.id,
      localDate: { lt: localDate },
    },
  });

  if (teachingDay) {
    return null;
  }

  const change = await readPlacementChange({
    attemptId: result.attemptId,
    finish: result.finish,
    goalId: goal.id,
  });

  if ((parsePlanChangePayload(change?.payload).lessonsSkipped ?? 0) === 0) {
    return null;
  }

  const lesson = await readPlacementNextLesson(goal.id, prisma);
  return lesson?.id ?? null;
}
