import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { type LearnerPlanOperation } from "./plan-contract";
import { parsePlanGraph } from "./planner/plan-state";

/** A Monday in 2020, before the learning events other tests write, so nobody's pace moves it. */
const NOW = new Date("2020-09-28T12:00:00Z");

/** Each area's lessons still to do in the saved plan, a stand-in as the lessons it was saved with. */
async function countAreaLessons(planId: string): Promise<Map<string, number>> {
  const [items, { graph }] = await Promise.all([
    prisma.planItem.findMany({ where: { kind: "lesson", planId, status: "todo" } }),
    prisma.plan.findUniqueOrThrow({ where: { id: planId } }),
  ]);

  const areaOf = new Map(parsePlanGraph(graph).skills.map((skill) => [skill.skillId, skill.area]));

  return items.reduce((areas, item) => {
    const area = areaOf.get(item.skillId ?? "") ?? "";
    return areas.set(area, (areas.get(area) ?? 0) + (item.lessonId ? 1 : (item.lessons ?? 1)));
  }, new Map<string, number>());
}

/**
 * An exam three weeks away, short on time: ethics is small enough to fit whole, exam strategy and
 * criminal law aren't. Applies the change and returns its result with each area's lessons still to
 * do before and after it.
 */
async function changeShortExam({
  dailyMinutes,
  operations,
  settings = {},
}: {
  dailyMinutes: number;
  operations: LearnerPlanOperation[];
  settings?: object;
}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Ética", lessons: 4 },
      { area: "Estratégia", lessons: 24 },
      { area: "Penal", lessons: 24 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    kind: "exam",
    settings: { startDate: "2020-09-28", ...settings },
    targetDate: new Date("2020-10-19T00:00:00Z"),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  const before = await countAreaLessons(plan.id);
  const result = await changeGoalPlan({ goalId: goal.id, input: { operations } });

  return { after: await countAreaLessons(plan.id), before, result };
}

describe("a change of where to focus on a plan short on time", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // OAB seed 1007: "more ethics, less exam strategy" moved criminal procedure, which the change
  // doesn't name, from 40 to 44 lessons, and the card said nothing (R2). Ethics already had every
  // lesson in, so the time strategy freed went to criminal procedure too.
  it("names on the card a subject it doesn't name whose lessons move by more than rounding", async () => {
    const { after, before, result } = await changeShortExam({
      dailyMinutes: 12,
      operations: [
        { areas: ["Ética"], kind: "focusAreas" },
        { areas: ["Estratégia"], kind: "reduceAreas" },
      ],
    });

    const [was = 0, now = 0] = [before.get("Penal"), after.get("Penal")];

    expect(now - was).toBeGreaterThan(2);

    expect(result).toMatchObject({
      change: { effect: { areaLessons: [{ after: now, area: "Penal", before: was }] } },
      status: "applied",
    });
  });

  // ENEM, Ana's walk: with math focused, choosing math and natural sciences read "Nothing
  // changed", though natural sciences alone gained 10 lessons: the change was judged on math too,
  // which shares some of its depth with the area added beside it.
  it("applies an area added beside one focused before, the card naming what the earlier one gives", async () => {
    const { after, before, result } = await changeShortExam({
      dailyMinutes: 15,
      operations: [{ areas: ["Penal", "Estratégia"], kind: "focusAreas" }],
      settings: { focusAreas: ["Penal"] },
    });

    const given = (before.get("Penal") ?? 0) - (after.get("Penal") ?? 0);
    const change = result.status === "applied" ? result.change : null;

    expect(after.get("Estratégia") ?? 0).toBeGreaterThan(before.get("Estratégia") ?? 0);
    expect(given).toBeGreaterThan(0);
    expect(change?.effect?.lessonsLeftOut).toHaveLength(given);
  });
});
