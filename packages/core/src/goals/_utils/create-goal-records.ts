import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getCertificateLanguage } from "../../exams/language-exam";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK } from "../../plans/planner/plan-state";
import { type GoalCreateInput, type GoalDraft } from "../goal-contract";

/** Study days become a weekly shape with rest days at zero; every day needs no shape. */
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
 * Creates one goal and its empty plan. An exam goal learns the language its notice says the exam
 * tests (`testedLanguage`), else the one onboarding read, else the one a certificate's name gives.
 */
export async function createGoal({
  dailyMinutes,
  draft,
  id,
  input,
  testedLanguage,
  userId,
}: {
  dailyMinutes: number;
  draft: GoalDraft;
  id: string;
  input: GoalCreateInput;
  testedLanguage: string | null;
  userId: string;
}): Promise<void> {
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });

  await prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { planInputs: true, userId });

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
  });
}

/** A retained active goal publishes no second change after an explanation is created. */
class ActiveGoalUnchangedError extends Error {
  override name = "ActiveGoalUnchangedError";
}

/** The goal creator owns this profile transition; it does not delegate acting identity to an app. */
export async function selectCreatedGoal({
  activeGoalId,
  userId,
}: {
  activeGoalId: string;
  userId: string;
}): Promise<void> {
  const { error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId });
      const current = await tx.userLearningProfile.findUnique({ where: { userId } });

      if (current?.activeGoalId === activeGoalId) {
        throw new ActiveGoalUnchangedError("The active goal did not change");
      }

      await tx.userLearningProfile.upsert({
        create: { activeGoalId, userId },
        update: { activeGoalId },
        where: { userId },
      });
    }),
  );

  if (error && !(error instanceof ActiveGoalUnchangedError)) {
    throw error;
  }
}
