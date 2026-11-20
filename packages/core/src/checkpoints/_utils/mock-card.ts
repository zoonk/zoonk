import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { isScheduledPaperComplete } from "../../exams/mocks/_utils/mock-complete";
import { getExamStartTime } from "../../exams/mocks/_utils/mock-conditions";
import { getBankTypedParts } from "../../exams/mocks/_utils/mock-typed-parts";
import { planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { readScheduledStructure } from "../../exams/mocks/_utils/read-mock-structure";
import { type GoalPlanSource } from "../../learner/_utils/goal-plan-source";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { readFinishedMockCount } from "../../learner/facts/finished-mocks";
import { readMockEssays } from "../../learner/facts/mock-essays";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { type MockIdentity, findScheduledMock } from "../../plans/planner/mock-identity";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { getTestSkillIds } from "../../sessions/_utils/review-skills";
import { toMockConditions } from "../weekly-challenge-rules";

/** Future mocks show exam conditions, since the bank will grow before their questions are selected. */
export async function loadMockCard({
  blueprint,
  date,
  goal,
  identity: selected,
  source,
  today,
}: {
  blueprint: ExamBlueprint | null;
  /** The mock's day, as a UTC-midnight label. */
  date: Date;
  goal: Goal;
  identity?: MockIdentity;
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

  const structure = readScheduledStructure({ blueprint, date, goal, settings: goalPlan?.settings });

  const identity =
    selected ??
    findScheduledMock({
      date: toIsoDate(date),
      funding: parsePlanSettings(goalPlan?.settings).mockFunding,
    });

  const planned = await planWeeklyMock({
    essays,
    finishedMocks: readFinishedMockCount(goal.userId, goal.id),
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

  const plan = planned.outline;

  return {
    conditions: toMockConditions({ plan, structure: planned.structure, typed }),
    preparing: date.getTime() <= today.getTime() && !isScheduledPaperComplete(planned),
    startTime: getExamStartTime({ day: plan.day, edition: content?.edition ?? null }),
    timeZone: content?.edition.timeZone ?? null,
  };
}
