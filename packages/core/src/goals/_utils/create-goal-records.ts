import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type AllowanceLimit } from "../../entitlements/contract";
import { getCertificateLanguage } from "../../exams/language-exam";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK } from "../../plans/planner/plan-state";
import { type GoalCreateInput, type GoalDraft } from "../goal-contract";
import { findActiveGoalLimit } from "./goal-status";

function getWeekdayMinutes({
  dailyMinutes,
  studyDays,
}: {
  dailyMinutes: number;
  studyDays?: number[];
}) {
  if (!studyDays || new Set(studyDays).size === DAYS_PER_WEEK) {
    return null;
  }

  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
    studyDays.includes(weekday) ? dailyMinutes : 0,
  );
}

/** The plan holds the exam subjects a goal is for, where every read of the exam's subjects finds them. */
function toScopeSettings(value: unknown): { examSubjects?: string[] } {
  const subjects = Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  return subjects.length > 0 ? { examSubjects: subjects } : {};
}

type GoalRecord = {
  dailyMinutes: number;
  draft: GoalDraft;
  id: string;
  input: Pick<GoalCreateInput, "studyDays" | "studyTime" | "timeZone">;
  testedLanguage: string | null;
  userId: string;
};

/** Runs in the caller's learner write, so a goal can be created atomically with other writes. */
export async function insertGoalWithPlan(
  tx: TransactionClient,
  {
    dailyMinutes,
    draft,
    id,
    input,
    planShown = false,
    replacesGoalId,
    testedLanguage,
    userId,
  }: GoalRecord & {
    /** The learner reaches this goal's plan without a reveal, so none is owed. */
    planShown?: boolean;
    replacesGoalId?: string;
  },
): Promise<void> {
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });
  const { examSubjects, ...details } = draft.details ?? {};

  await tx.goal.create({
    data: {
      dailyMinutes,
      details,
      examBlueprintId: draft.examBlueprintId ?? null,
      id,
      kind: draft.kind,
      language: draft.language,
      planRevealedAt: planShown ? new Date() : null,
      primaryCourseId: draft.primaryCourseId ?? null,
      prompt: draft.prompt,
      replacesGoalId: replacesGoalId ?? null,
      studyTime: input.studyTime ?? null,
      targetDate: draft.targetDate ? fromIsoDate(draft.targetDate) : null,
      targetLanguage: testedLanguage ?? draft.targetLanguage ?? getCertificateLanguage(draft),
      timezone: input.timeZone ?? null,
      title: draft.title,
      userId,
    },
  });

  await tx.plan.create({
    data: {
      goalId: id,
      settings: {
        ...toScopeSettings(examSubjects),
        startDate: toIsoDate(getDateInTimeZone({ date: new Date(), timeZone })),
        ...(draft.kind === "language" && { stopsAtAim: true }),
        weekdayMinutes: getWeekdayMinutes({ dailyMinutes, studyDays: input.studyDays }),
      },
    },
  });
}

/**
 * Recounts active goals under the plan→user lock: a usage claim that passed earlier can't promise
 * the slot is still free.
 */
export async function createGoal(
  record: GoalRecord & { input: GoalCreateInput },
): Promise<AllowanceLimit | null> {
  const { draft, id, userId } = record;

  return writeLearnerChange<null, AllowanceLimit>({ planInputs: true, userId }, async (tx) => {
    if (draft.kind !== "explain") {
      const limit = await findActiveGoalLimit({ db: tx, goalId: id, userId });

      if (limit) {
        return unchanged(limit);
      }
    }

    await insertGoalWithPlan(tx, record);
    return null;
  });
}

export async function setActiveGoal(
  tx: TransactionClient,
  { activeGoalId, userId }: { activeGoalId: string; userId: string },
): Promise<boolean> {
  const current = await tx.userLearningProfile.findUnique({ where: { userId } });

  if (current?.activeGoalId === activeGoalId) {
    return false;
  }

  await tx.userLearningProfile.upsert({
    create: { activeGoalId, userId },
    update: { activeGoalId },
    where: { userId },
  });

  return true;
}

export async function selectCreatedGoal({
  activeGoalId,
  userId,
}: {
  activeGoalId: string;
  userId: string;
}): Promise<void> {
  await writeLearnerChange({ planInputs: true, userId }, async (tx) =>
    (await setActiveGoal(tx, { activeGoalId, userId })) ? null : unchanged(null),
  );
}
