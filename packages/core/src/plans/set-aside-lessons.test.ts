import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getPlanTabView } from "../view-models/plan/get-plan-view";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Monday in 2020, before the learning events other tests write, so their pace stays out. */
const MONDAY = new Date("2020-09-28T12:00:00Z");

describe("lessons set aside after their last held-back draft", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stay out of plans built later, which plan the skill's other lessons", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 3 }] });
    const [setAside, ...others] = library.lessons;

    await prisma.lesson.update({ data: { setAsideAt: MONDAY }, where: { id: setAside?.id } });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id },
    });

    expect(items.map((item) => item.lessonId)).toStrictEqual(others.map((lesson) => lesson.id));
  });
});

async function missedDaysPlan(credit: "done" | "testedOut" | null) {
  const [user, library, blueprint] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 3 }, { lessons: 3 }] }),
    examBlueprintFixture({
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: [
          {
            citation: { passage: "Exam topics", sourceId: "notice" },
            name: "Science",
            questions: 10,
            topics: ["Atoms", "Light"],
            weight: null,
          },
        ],
      },
    }),
  ]);

  const graph = {
    ...library.graph,
    skills: library.graph.skills.map((skill, index) => ({
      ...skill,
      area: "Science",
      topics: [index === 0 ? "Atoms" : "Light"],
    })),
  };

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-19T00:00:00Z"),
    timezone: "UTC",
    userId: user.id,
  });

  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  await createGoalPlan({ goalId: goal.id, graph });
  mockSession(user.id);

  const lessons = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId: plan.id },
  });

  expect(lessons).toHaveLength(6);

  await prisma.planItem.updateMany({
    data: { completedAt: MONDAY, status: "done" },
    where: {
      id: {
        in: lessons.filter((item) => item.skillId === library.skills[0]?.id).map((item) => item.id),
      },
    },
  });

  const light = lessons.filter((item) => item.skillId === library.skills[1]?.id);
  expect(light).toHaveLength(3);

  if (credit) {
    await prisma.planItem.update({
      data: { completedAt: MONDAY, status: credit },
      where: { id: light[0]?.id },
    });
  }

  vi.setSystemTime(new Date("2020-10-20T12:00:00Z"));
  await refreshGoalPlan({ goalId: goal.id });

  const setAside = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId: plan.id, skillId: library.skills[1]?.id, status: "skipped" },
  });

  expect(setAside.map((item) => item.id)).toStrictEqual(
    light.slice(credit ? 1 : 0).map((item) => item.id),
  );

  expect(setAside.every((item) => item.minutes === 0)).toBe(true);

  return { goal };
}

async function readTopicCoverage(goalId: string) {
  const [main, api, syllabus] = await Promise.all([
    getPlanTabView({ goalId }),
    getGoalPlan(goalId),
    getSyllabusView({ goalId }),
  ]);

  expect(main.status).toBe("ready");
  expect(api.status).toBe("ready");
  expect(syllabus.status).toBe("ready");

  return {
    apiCoreFits: api.status === "ready" ? api.plan.feasibility?.coreFits : null,
    mainCoreFits: main.status === "ready" ? main.view.plan.feasibility?.coreFits : null,
    topics:
      syllabus.status === "ready"
        ? syllabus.syllabus.subjects.flatMap((subject) => subject.topics)
        : [],
  };
}

describe("topic coverage after missed days set lessons aside", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts a whole topic set aside after missed days as out for time in Plan and API", async () => {
    const { goal } = await missedDaysPlan(null);
    const coverage = await readTopicCoverage(goal.id);

    expect(coverage.topics.find((topic) => topic.name === "Light")).toMatchObject({
      chapters: [],
      notPlannedReason: "time",
      status: "notPlanned",
    });

    expect(coverage.topics.find((topic) => topic.name === "Atoms")).toMatchObject({
      notPlannedReason: null,
      status: "studied",
    });

    expect({ api: coverage.apiCoreFits, main: coverage.mainCoreFits }).toStrictEqual({
      api: false,
      main: false,
    });
  });

  it.each(["done", "testedOut"] as const)(
    "keeps %s topic credit when the remaining lessons are set aside for time",
    async (credit) => {
      const { goal } = await missedDaysPlan(credit);
      const coverage = await readTopicCoverage(goal.id);
      const topic = coverage.topics.find((entry) => entry.name === "Light");

      expect({ api: coverage.apiCoreFits, main: coverage.mainCoreFits }).toStrictEqual({
        api: true,
        main: true,
      });

      expect(topic).toMatchObject({ notPlannedReason: "time", status: "inProgress" });
      expect(topic?.chapters).toHaveLength(1);
    },
  );
});
