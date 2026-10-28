import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { readExamChoices } from "../../exams/choices/exam-choices";
import { getExamStartTime } from "../../exams/mocks/_utils/mock-conditions";
import { getBankTypedParts } from "../../exams/mocks/_utils/mock-typed-parts";
import { planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { readMockStructure } from "../../exams/mocks/_utils/read-mock-structure";
import { countPlannedQuestions, outlineMock } from "../../exams/mocks/mock-plan";
import { type GoalPlanSource } from "../../learner/_utils/goal-plan-source";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { readMockEssays } from "../../learner/facts/mock-essays";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { findScheduledMock } from "../../plans/planner/mock-identity";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { getGoalDayMinutes } from "../../sessions/_utils/day-minutes";
import { getTestSkillIds } from "../../sessions/_utils/review-skills";
import { MIN_CHECKPOINT_QUESTIONS } from "../checkpoint-rules";
import { toMockConditions } from "../weekly-challenge-rules";

/** Future mocks show exam conditions, since the bank will grow before their questions are selected. */
export async function loadMockCard({
  blueprint,
  date,
  goal,
  source,
  today,
}: {
  blueprint: ExamBlueprint | null;
  /** The mock's day, as a UTC-midnight label. */
  date: Date;
  goal: Goal;
  source?: Pick<GoalPlanSource, "graph" | "settings">;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}) {
  const content = blueprint ? readBlueprintContent(blueprint) : null;

  const [saved, { skills }, essays, typed] = await Promise.all([
    readSavedPlan(goal.userId, goal.id),
    readGoalPlan(goal.id),
    readMockEssays(goal.userId, goal.id, goal.examBlueprintId),
    getBankTypedParts(goal.examBlueprintId),
  ]);

  const goalPlan = source ?? saved;

  const dayMinutes = getGoalDayMinutes({ date, goal, planSettings: goalPlan?.settings });

  const structure = blueprint
    ? readMockStructure({ blueprint, choices: readExamChoices(goalPlan?.settings), dayMinutes })
    : null;

  const identity = findScheduledMock({
    date: toIsoDate(date),
    funding: parsePlanSettings(goalPlan?.settings).mockFunding,
  });

  const planned = await planWeeklyMock({
    essays,
    goal,
    identity,
    savedPlan: saved ?? undefined,
    skillIds: getTestSkillIds({
      graph: parsePlanGraph(goalPlan?.graph),
      planSkillIds: skills.map((skill) => skill.id),
      settings: goalPlan?.settings,
    }),
    structure,
    today: date,
    userId: goal.userId,
  });

  const isAhead = date.getTime() > today.getTime();

  const plan =
    !isAhead && countPlannedQuestions(planned) >= MIN_CHECKPOINT_QUESTIONS
      ? planned
      : outlineMock({
          clock: identity ? planned.minutes : undefined,
          day: planned.day,
          essays,
          fullLength: planned.fullLength,
          structure,
        });

  return {
    conditions: toMockConditions({ plan, structure, typed }),
    startTime: getExamStartTime({ day: plan.day, edition: content?.edition ?? null }),
    timeZone: content?.edition.timeZone ?? null,
  };
}
