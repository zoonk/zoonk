import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { readExamChoices } from "../../exams/choices/exam-choices";
import { getExamStartTime } from "../../exams/mocks/_utils/mock-conditions";
import { loadMockEssays } from "../../exams/mocks/_utils/mock-essays";
import { loadBankTypedParts } from "../../exams/mocks/_utils/mock-typed-parts";
import { planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { readMockStructure } from "../../exams/mocks/_utils/read-mock-structure";
import { countPlannedQuestions, outlineMock } from "../../exams/mocks/mock-plan";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { parsePlanGraph } from "../../plans/planner/plan-state";
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
  today,
}: {
  blueprint: ExamBlueprint | null;
  /** The mock's day, as a UTC-midnight label. */
  date: Date;
  goal: Goal;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}) {
  const content = blueprint ? readBlueprintContent(blueprint) : null;

  // Only reads render a card, so the goal's skills come from the request's one load of them.
  const [goalPlan, { skills }, essays, typed] = await Promise.all([
    prisma.plan.findUnique({ select: { graph: true, settings: true }, where: { goalId: goal.id } }),
    readGoalPlan(goal.id),
    loadMockEssays({ goal, userId: goal.userId }),
    loadBankTypedParts(goal.examBlueprintId),
  ]);

  const dayMinutes = getGoalDayMinutes({ date, goal, planSettings: goalPlan?.settings });

  // A class test's short mock fits the time the learner gives its day, as its session does.
  const structure = blueprint
    ? readMockStructure({ blueprint, choices: readExamChoices(goalPlan?.settings), dayMinutes })
    : null;

  // The mock asks every topic of the test, as its session does (see `loadSessionWeeklyChallenge`).
  const planned = await planWeeklyMock({
    essays,
    goal,
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
      : outlineMock({ day: planned.day, essays, fullLength: planned.fullLength, structure });

  return {
    conditions: toMockConditions({ plan, structure, typed }),
    startTime: getExamStartTime({ day: plan.day, edition: content?.edition ?? null }),
    timeZone: content?.edition.timeZone ?? null,
  };
}
