import "server-only";
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

/**
 * Recounts active goals under the plan→user lock: a usage claim that passed earlier can't promise
 * the slot is still free.
 */
export async function createGoal({
  dailyMinutes,
  draft,
  id,
  input,
  replacing = false,
  testedLanguage,
  userId,
}: {
  dailyMinutes: number;
  draft: GoalDraft;
  id: string;
  input: GoalCreateInput;
  replacing?: boolean;
  testedLanguage: string | null;
  userId: string;
}): Promise<AllowanceLimit | null> {
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });

  return writeLearnerChange<null, AllowanceLimit>({ planInputs: true, userId }, async (tx) => {
    if (!replacing && draft.kind !== "explain") {
      const limit = await findActiveGoalLimit({ db: tx, goalId: id, userId });

      if (limit) {
        return unchanged(limit);
      }
    }

    await tx.goal.create({
      data: {
        dailyMinutes,
        details: draft.details ?? {},
        examBlueprintId: draft.examBlueprintId ?? null,
        id,
        kind: draft.kind,
        language: draft.language,
        primaryCourseId: draft.primaryCourseId ?? null,
        prompt: draft.prompt,
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
          startDate: toIsoDate(getDateInTimeZone({ date: new Date(), timeZone })),
          weekdayMinutes: getWeekdayMinutes({ dailyMinutes, studyDays: input.studyDays }),
        },
      },
    });

    return null;
  });
}

export async function selectCreatedGoal({
  activeGoalId,
  userId,
}: {
  activeGoalId: string;
  userId: string;
}): Promise<void> {
  await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const current = await tx.userLearningProfile.findUnique({ where: { userId } });

    if (current?.activeGoalId === activeGoalId) {
      return unchanged(null);
    }

    await tx.userLearningProfile.upsert({
      create: { activeGoalId, userId },
      update: { activeGoalId },
      where: { userId },
    });
  });
}
