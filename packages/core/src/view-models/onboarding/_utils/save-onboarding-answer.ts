import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type Plan, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getLeastDailyBudget, splitDailyBudget } from "../../../goals/daily-budget";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { getPlanState } from "../../../plans/_utils/plan-context";
import { type PlanOperation } from "../../../plans/plan-contract";
import { fromIsoDate, toIsoDate } from "../../../plans/planner/plan-calendar";
import { applyPlanOperations } from "../../../plans/planner/plan-operations";
import { type PlanSettings, type PlanState } from "../../../plans/planner/plan-state";
import { getScheduleOperations } from "../../../plans/planner/schedule-operations";
import { assertTargetDates } from "../../../plans/target-date-range";
import { getAnsweredQuestions } from "../onboarding-steps";
import { getExamChoiceOperations } from "./exam-choice-answer";
import {
  type GoalAnswerInput,
  getCountryAnswerData,
  getDetailChanges,
  isInvalidGoalAnswer,
  withoutReplacedAnswer,
} from "./onboarding-answer-details";
import { findOnboardingGoalIds } from "./onboarding-goals";
import { saveAnswerGoal } from "./save-answer-goal";

/** Goals typed together share the day's time: the main one gets the bigger share. */
function shareMinutes({ goalIds, minutes }: { goalIds: string[]; minutes: number }) {
  const shares = splitDailyBudget({ budget: minutes, count: goalIds.length });
  return new Map(goalIds.map((id, index) => [id, shares[index] ?? minutes]));
}

function getAnswerSchedule({
  currentId,
  goalId,
  input,
  shares,
  weekends,
}: {
  currentId: string;
  goalId: string;
  input: GoalAnswerInput;
  shares: Map<string, number> | null;
  weekends: Map<string, number> | null;
}) {
  if (input.question === "schedule") {
    return {
      dailyMinutes: shares?.get(currentId),
      studyDays: input.studyDays,
      weekendMinutes: weekends?.get(currentId),
    };
  }

  return currentId === goalId && input.question === "targetDate"
    ? { targetDate: input.targetDate }
    : {};
}

async function saveAnswerSettings(
  tx: TransactionClient,
  {
    input,
    plan,
    previous,
    settings,
  }: { input: GoalAnswerInput; plan: Plan | null; previous: PlanSettings; settings: PlanSettings },
): Promise<boolean> {
  if (!plan) {
    return false;
  }

  const settingsChanged = !isDeepStrictEqual(settings, previous);
  const endsRoutine = input.question === "schedule" && plan.setupTasks.includes("routine");

  if (!settingsChanged && !endsRoutine) {
    return false;
  }

  await tx.plan.update({
    data: {
      ...(settingsChanged && { settings }),
      ...(endsRoutine && { setupTasks: plan.setupTasks.filter((task) => task !== "routine") }),
    },
    where: { id: plan.id },
  });

  return true;
}

/** `current` carries the details with this answer, so the words it adds can name an exam's option. */
async function getAnswerOperations({
  current,
  goalId,
  input,
  schedule,
  state,
  tx,
}: {
  current: Goal;
  goalId: string;
  input: GoalAnswerInput;
  schedule: Parameters<typeof getScheduleOperations>[0]["input"];
  state: PlanState;
  tx: TransactionClient;
}) {
  const operations: PlanOperation[] = getScheduleOperations({ input: schedule, state });

  if (current.id !== goalId) {
    return operations;
  }

  if (current.kind === "exam" && input.question === "schedule" && input.fullCourse !== undefined) {
    operations.push({ fullCourse: input.fullCourse, kind: "setFullCourse" });
  }

  const choices = await getExamChoiceOperations({ goal: current, input, state, tx });
  return choices && [...operations, ...choices];
}

export async function saveAnswerInputs({
  goal,
  input,
}: {
  goal: Goal;
  input: GoalAnswerInput;
}): Promise<
  | { goalIds: string[]; status: "invalid" | "notFound" | "saved" }
  | { goals: number; minutes: number; status: "dayTooShort" }
> {
  if (isInvalidGoalAnswer({ current: goal, input })) {
    return { goalIds: [goal.id], status: "invalid" };
  }

  const goalIds = input.question === "schedule" ? await findOnboardingGoalIds(goal) : [goal.id];
  const least = getLeastDailyBudget(goalIds.length);

  if (
    input.question === "schedule" &&
    (input.dailyMinutes < least || (input.weekendMinutes ?? least) < least)
  ) {
    return { goals: goalIds.length, minutes: least, status: "dayTooShort" };
  }

  const shares =
    input.question === "schedule" ? shareMinutes({ goalIds, minutes: input.dailyMinutes }) : null;

  const weekends =
    input.question === "schedule" && input.weekendMinutes !== undefined
      ? shareMinutes({ goalIds, minutes: input.weekendMinutes })
      : null;

  const changedGoalIds: string[] = [];

  const status = await writeLearnerChange<"invalid" | "notFound" | "saved">(
    { goalIds, planInputs: true, userId: goal.userId },
    async (tx) => {
      const currentGoals = await tx.goal.findMany({
        include: { plan: true },
        where: { id: { in: goalIds }, userId: goal.userId },
      });

      if (!currentGoals.some((current) => current.id === goal.id)) {
        return unchanged("notFound");
      }

      for (const current of currentGoals) {
        if (isInvalidGoalAnswer({ current, input })) {
          return unchanged("invalid");
        }

        const own = current.id === goal.id;
        const details = isJsonObject(current.details) ? current.details : {};

        const state = getPlanState({
          goal: current,
          plan: current.plan ?? { graph: {}, settings: {} },
        });

        const timeZone = getAnswerTimeZone({
          goal: current,
          timeZone: input.question === "schedule" ? input.timeZone : undefined,
        });

        const today = getDateInTimeZone({ date: new Date(), timeZone });

        const schedule = getAnswerSchedule({
          currentId: current.id,
          goalId: goal.id,
          input,
          shares,
          weekends,
        });

        // Unlike a plan change, onboarding can't keep a date that is gone: no plan can be made for it.
        if (schedule.targetDate && schedule.targetDate <= toIsoDate(today)) {
          return unchanged("invalid");
        }

        assertTargetDates({
          latestOnly: true,
          targets: [
            {
              current: state.goal.targetDate,
              path: ["targetDate"],
              targetDate: schedule.targetDate,
            },
          ],
          today: toIsoDate(today),
        });

        const answeredDetails = {
          ...withoutReplacedAnswer({ details, input }),
          ...getDetailChanges({ details, input }),
          answered: [...new Set([...getAnsweredQuestions(details), input.question])],
        };

        // oxlint-disable-next-line no-await-in-loop -- Choices are validated on the answer's transaction client.
        const operations = await getAnswerOperations({
          current: { ...current, details: answeredDetails },
          goalId: goal.id,
          input,
          schedule,
          state,
          tx,
        });

        if (!operations) {
          return unchanged("invalid");
        }

        const applied = applyPlanOperations({ goalKind: current.kind, operations, state, today });

        if ("error" in applied) {
          return unchanged("invalid");
        }

        const data = {
          ...(own && getCountryAnswerData(input)),
          dailyMinutes: applied.state.goal.dailyMinutes,
          ...(own && { details: answeredDetails }),
          targetDate: applied.state.goal.targetDate
            ? fromIsoDate(applied.state.goal.targetDate)
            : null,
          timezone:
            input.question === "schedule" ? (input.timeZone ?? current.timezone) : current.timezone,
        };

        // oxlint-disable-next-line no-await-in-loop -- Answers and their owed work share the transaction.
        const goalChanged = await saveAnswerGoal({ current, data, input, own, tx });

        // oxlint-disable-next-line no-await-in-loop -- Shared answers commit on one transaction client.
        const settingsChanged = await saveAnswerSettings(tx, {
          input,
          plan: current.plan,
          previous: state.settings,
          settings: applied.state.settings,
        });

        if (goalChanged || settingsChanged) {
          changedGoalIds.push(current.id);
        }
      }

      return changedGoalIds.length > 0 ? "saved" : unchanged("saved");
    },
  );

  return { goalIds: changedGoalIds, status };
}
