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

/**
 * A mock's card: the planned mock's size and time, and when the real exam starts. A mock still
 * days away says what the exam's conditions set for it (half the exam day on regular weeks, all
 * of it in the final stretch): its questions are picked on its day from what the bank has then,
 * so today's bank, which grows with every study day, would make it read like a broken mock of six
 * questions.
 */
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
  /** A stale read renders the same selected allocation as its day and notice. */
  source?: Pick<GoalPlanSource, "graph" | "settings">;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}) {
  const content = blueprint ? readBlueprintContent(blueprint) : null;

  // Only reads render a card, so the goal's plan, skills and essays come from the request's one
  // load of them, the ones the mocks any time read too.
  const [saved, { skills }, essays, typed] = await Promise.all([
    readSavedPlan(goal.userId, goal.id),
    readGoalPlan(goal.id),
    readMockEssays(goal.userId, goal.id, goal.examBlueprintId),
    getBankTypedParts(goal.examBlueprintId),
  ]);

  const goalPlan = source ?? saved;

  const dayMinutes = getGoalDayMinutes({ date, goal, planSettings: goalPlan?.settings });

  // A class test's short mock fits the time the learner gives its day, as its session does.
  const structure = blueprint
    ? readMockStructure({ blueprint, choices: readExamChoices(goalPlan?.settings), dayMinutes })
    : null;

  // The mock asks every topic of the test, as its session does (see `loadSessionWeeklyChallenge`).
  // The mock sits the exam day and length its plan saved for it (see `MockIdentity`).
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

  // On its day, or while the bank has too few unseen questions, the card says what the exam's
  // conditions set.
  const isAhead = date.getTime() > today.getTime();

  const plan =
    !isAhead && countPlannedQuestions(planned) >= MIN_CHECKPOINT_QUESTIONS
      ? planned
      : outlineMock({
          // A scheduled mock keeps its real time limit on its card too (see `getMockClock`).
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
