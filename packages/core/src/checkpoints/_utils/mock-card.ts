import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { isScheduledPaperComplete } from "../../exams/mocks/_utils/mock-complete";
import { getExamStartTime } from "../../exams/mocks/_utils/mock-conditions";
import { getBankTypedParts } from "../../exams/mocks/_utils/mock-typed-parts";
import { loadWeeklyOutline, planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { readScheduledStructure } from "../../exams/mocks/_utils/read-mock-structure";
import { hasMockWriting } from "../../exams/mocks/written-test-plan";
import { type GoalPlanSource } from "../../learner/_utils/goal-plan-source";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { readFinishedMockCount } from "../../learner/facts/finished-mocks";
import { readMockEssays } from "../../learner/facts/mock-essays";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { type MockIdentity, findScheduledMock } from "../../plans/planner/mock-identity";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../plans/planner/plan-state";
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

  const input = {
    finishedMocks: identity ? undefined : readFinishedMockCount(goal.userId, goal.id),
    goal,
    graph: goalPlan?.graph,
    identity,
    savedPlan: saved ?? undefined,
    skillIds: skills.map((skill) => skill.id),
    structure,
    today: date,
    userId: goal.userId,
  };

  const planned = date <= today ? await planWeeklyMock(input) : null;
  const { outline: plan } = planned ?? (await loadWeeklyOutline(input));

  return {
    conditions: toMockConditions({ plan, structure, typed }),
    preparing:
      planned !== null &&
      !isScheduledPaperComplete(
        planned,
        hasMockWriting({
          essays,
          shape: { day: plan.day, kind: plan.fullLength ? "full" : "half" },
          structure,
        }),
      ),
    startTime: getExamStartTime({ day: plan.day, edition: content?.edition ?? null }),
    timeZone: content?.edition.timeZone ?? null,
  };
}
