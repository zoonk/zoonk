import "server-only";
import { type GoalTutorLookUpResult } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { mockConditionsSchema, mockResultSchema } from "../../../exams/mocks/mock-contract";
import { getMockProgress } from "../../../exams/view/_utils/mock-progress";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { toIsoDate } from "../../../plans/planner/plan-calendar";

const MAX_MOCKS = 5;

/** Estimated ranges appear only when the exam's scoring supports them. */
export async function lookUpMocks(goal: Goal): Promise<GoalTutorLookUpResult> {
  const rows = await prisma.mockExam.findMany({
    // Preserve the mock numbers learners saw on their result screens.
    orderBy: { createdAt: "asc" },
    select: { conditions: true, finishedAt: true, result: true },
    where: { goalId: goal.id, status: "finished", userId: goal.userId },
  });

  const finished = rows.flatMap((row, index) => {
    const result = mockResultSchema.safeParse(row.result).data;
    const conditions = mockConditionsSchema.safeParse(row.conditions).data;

    return result && row.finishedAt
      ? [
          {
            finishedAt: row.finishedAt,
            number: index + 1,
            purpose: conditions?.purpose ?? "planned",
            result,
            reused: conditions?.reused ?? 0,
            shape: conditions?.shape ?? null,
          },
        ]
      : [];
  });

  const progress = getMockProgress(finished);

  if (!progress) {
    return { status: "notFound", what: "mocks" };
  }

  const timeZone = getAnswerTimeZone({ goal });

  const mocks = finished
    .toReversed()
    .slice(0, MAX_MOCKS)
    .map(({ finishedAt, number, result, shape }) => ({
      areas: result.areas.map((area) => ({
        correct: area.correct,
        name: area.name,
        total: area.total,
      })),
      correct: result.correct,
      date: toIsoDate(getDateInTimeZone({ date: finishedAt, timeZone })),
      estimate: result.irt ? { high: result.irt.high, low: result.irt.low } : null,
      kind: shape?.kind ?? null,
      net: result.scoring === "net" && result.net ? result.net.net : null,
      number,
      subject: shape?.area ?? null,
      total: result.total,
    }));

  return {
    improved: progress.improved,
    mocks,
    needsWork: progress.needsWork,
    status: "found",
    what: "mocks",
  };
}
