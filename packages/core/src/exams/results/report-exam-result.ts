import "server-only";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { proposeNoticeChange } from "../../plans/notice-plan-change";
import { fromIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { getExamCalendar, toExamDates } from "../_utils/exam-calendar";
import { loadGoalScoreEstimate } from "../estimates/load-goal-estimate";
import { getExamStage } from "../final-stretch/final-stretch-rules";
import {
  type ExamResultInput,
  type ExamResultView,
  percentToPoints,
  toExamResultView,
} from "./exam-result-contract";

export type ReportExamResultResult =
  | { result: ExamResultView; status: "reported" }
  | { status: "notExam" }
  | { status: "notFound" }
  | { status: "tooEarly" }
  | { status: "unauthorized" };

async function loadEstimateBefore({
  goal,
  input,
  userId,
}: {
  goal: { examBlueprintId: string | null; id: string; title: string };
  input: ExamResultInput;
  userId: string;
}): Promise<{ high: number; low: number } | null> {
  const inputs = await loadPreparationInputs({ goalId: goal.id, now: new Date(), userId });
  const estimate = await loadGoalScoreEstimate({ goal, ledgerMocks: inputs.mockResults });

  if (!estimate) {
    return null;
  }

  if (estimate.scale === input.scale) {
    return estimate;
  }

  if (estimate.scale === "percent" && input.scale === "points" && input.maxScore !== null) {
    const { maxScore } = input;

    return {
      high: percentToPoints({ maxScore, percent: estimate.high }),
      low: percentToPoints({ maxScore, percent: estimate.low }),
    };
  }

  return null;
}

function isExamOver({
  days,
  stage,
  today,
}: {
  days: readonly Date[];
  stage: ReturnType<typeof getExamStage>;
  today: Date;
}): boolean {
  const last = days.toSorted((a, b) => a.getTime() - b.getTime()).at(-1);
  return stage === "afterExam" || (stage === "examDay" && last?.getTime() === today.getTime());
}

async function offerNextSitting(goalId: string): Promise<void> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });

  if (plan && parsePlanSettings(plan.settings).fullCourse) {
    await safeAsync(() => proposeNoticeChange({ goalId }));
  }
}

export async function reportExamResult({
  goalId,
  input,
  timeZone: requestTimeZone,
}: {
  goalId: string;
  input: ExamResultInput;
  timeZone?: string;
}): Promise<ReportExamResultResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "exam") {
    return { status: "notExam" };
  }

  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;

  const calendar = getExamCalendar({ blueprint, goal });
  const timeZone = getAnswerTimeZone({ goal, timeZone: requestTimeZone });
  const today = getDateInTimeZone({ date: new Date(), timeZone });
  const stage = getExamStage({ examDays: toExamDates(calendar), today });

  if (stage !== "examDay" && stage !== "afterExam") {
    return { status: "tooEarly" };
  }

  const [estimate, mocksTaken] = await Promise.all([
    loadEstimateBefore({ goal, input, userId }),
    prisma.mockExam.count({ where: { goalId, status: "finished" } }),
  ]);

  const firstDay = calendar.days[0]?.date;

  const data = {
    estimateHigh: estimate?.high ?? null,
    estimateLow: estimate?.low ?? null,
    examBlueprintId: goal.examBlueprintId,
    examDate: firstDay ? fromIsoDate(firstDay) : null,
    examName: blueprint?.name ?? goal.title,
    maxScore: input.scale === "points" ? input.maxScore : null,
    mocksTaken,
    passed: input.passed,
    reportedAt: new Date(),
    scale: input.score === null ? null : input.scale,
    score: input.score,
  };

  const row = await writeLearnerChange({ userId }, async (tx) => {
    const current = await tx.examResult.findUnique({ where: { goalId } });
    const { reportedAt: _reportedAt, ...result } = data;

    if (
      current &&
      Object.entries(result).every(([key, value]) =>
        isDeepStrictEqual(Reflect.get(current, key), value),
      )
    ) {
      return unchanged(current);
    }

    return tx.examResult.upsert({
      create: { ...data, goalId, userId },
      update: data,
      where: { goalId },
    });
  });

  revalidateCacheTags([getLearnerModelCacheTag(userId)]);

  await trackLearnerEvents({
    events: [
      {
        name: "Exam Result Reported",
        properties: {
          exam_blueprint_id: goal.examBlueprintId,
          passed: row.passed,
          score: row.score,
        },
      },
    ],
    goalId,
    userId,
  });

  if (isExamOver({ days: toExamDates(calendar), stage, today })) {
    await offerNextSitting(goalId);
  }

  return { result: toExamResultView(row), status: "reported" };
}
