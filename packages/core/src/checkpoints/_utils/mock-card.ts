import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { getExamStartTime } from "../../exams/mocks/_utils/mock-conditions";
import { planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { withClassTestMock } from "../../exams/mocks/class-test-mock";
import { countPlannedQuestions, outlineMock } from "../../exams/mocks/mock-plan";
import { loadGoalSkillIds } from "../../learner/_utils/goal-skill-graph";
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

  const [goalPlan, planSkillIds] = await Promise.all([
    prisma.plan.findUnique({ select: { graph: true, settings: true }, where: { goalId: goal.id } }),
    loadGoalSkillIds(goal.id),
  ]);

  const dayMinutes = getGoalDayMinutes({ date, goal, planSettings: goalPlan?.settings });

  // A class test's short mock fits the time the learner gives its day, as its session does.
  const structure =
    blueprint && content
      ? withClassTestMock({ dayMinutes, ownerId: blueprint.ownerId, structure: content.structure })
      : null;

  // The mock asks every topic of the test, as its session does (see `loadSessionWeeklyChallenge`).
  const planned = await planWeeklyMock({
    goal,
    skillIds: getTestSkillIds({
      graph: parsePlanGraph(goalPlan?.graph),
      planSkillIds,
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
      : outlineMock({ day: planned.day, fullLength: planned.fullLength, structure });

  return {
    conditions: toMockConditions({ plan, structure }),
    startTime: getExamStartTime({ day: plan.day, edition: content?.edition ?? null }),
    timeZone: content?.edition.timeZone ?? null,
  };
}
