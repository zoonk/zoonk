import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateGoal } from "../goals/update-goal";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { type PlanEffect } from "./planner/plan-effect";
import { parsePlanSettings } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Monday in 2020, before the learning events other tests write, so nobody's pace moves it. */
const NOW = new Date("2020-09-28T12:00:00Z");

const AREAS = ["Matemática", "Natureza", "Humanas"] as const;

const citation = { passage: "Conteúdo programático", sourceId: "notice" };

const SKILLS = AREAS.flatMap((area) => [
  { area, lessons: 6, phase: 0, topic: `${area}: fundamentos` },
  { area, lessons: 6, phase: 1, topic: `${area}: aplicação` },
]);

async function setup({
  dailyMinutes,
  daysAway,
  mockMinutes = null,
  lessonMinutes = 3,
}: {
  dailyMinutes: number;
  daysAway: number;
  mockMinutes?: number | null;
  lessonMinutes?: number;
}) {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    structure: examStructureSchema.parse({
      formats: [],
      mock:
        mockMinutes === null
          ? null
          : {
              adaptive: false,
              citations: [citation],
              order: null,
              scoring: { description: "Correct answers", method: "raw" },
              sections: [],
              timeLimitMinutes: mockMinutes,
              totalQuestions: 30,
            },
      rules: [],
      subjects: AREAS.map((area) => ({
        citation,
        name: area,
        questions: 10,
        topics: SKILLS.filter((skill) => skill.area === area).map((skill) => skill.topic),
        weight: null,
      })),
    }),
  });

  const library = await planLibraryFixture({ phases: ["Basics", "Further"], skills: SKILLS });

  await prisma.lesson.updateMany({
    data: { estimatedMinutes: lessonMinutes },
    where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
  });

  const graph = {
    ...library.graph,
    skills: library.graph.skills.map((skill, index) => ({
      ...skill,
      topics: [SKILLS[index]?.topic ?? ""],
    })),
  };

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date(NOW.getTime() + daysAway * 86_400_000),
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph });
  mockSession(user.id);

  return { goal, library, plan };
}

async function plannedTopics({
  library,
  planId,
}: {
  library: { skills: readonly { id: string }[] };
  planId: string;
}): Promise<Set<string>> {
  const items = await prisma.planItem.findMany({ where: { kind: "lesson", planId } });
  const skillIds = new Set(items.flatMap((item) => (item.skillId ? [item.skillId] : [])));

  return new Set(
    library.skills.flatMap((skill, index) =>
      skillIds.has(skill.id) ? [SKILLS[index]?.topic ?? ""] : [],
    ),
  );
}

function namedTopics(effect: PlanEffect | undefined) {
  return {
    added: (effect?.topicsAdded ?? []).flatMap((area) => area.topics).toSorted(),
    leftOut: (effect?.topicsLeftOut ?? []).flatMap((area) => area.topics).toSorted(),
  };
}

async function readChange({
  kind,
  planId,
}: {
  kind: "missedDays" | "resumed" | "testedOut";
  planId: string;
}) {
  const change = await prisma.planChange.findFirstOrThrow({ where: { kind, planId } });
  const { effect } = change.payload as { effect?: PlanEffect };

  return namedTopics(effect);
}

function difference(from: Set<string>, to: Set<string>): string[] {
  return [...from].filter((topic) => !to.has(topic)).toSorted();
}

describe("a change the learner didn't make names the topics it moves", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the topics a test-out brings into the plan", async () => {
    const { goal, library, plan } = await setup({
      dailyMinutes: 9,
      daysAway: 14,
      lessonMinutes: 7,
      mockMinutes: 30,
    });

    const before = await plannedTopics({ library, planId: plan.id });
    const [known] = library.skills;

    expect(before.has("Matemática: fundamentos")).toBe(true);
    expect(before.has("Matemática: aplicação")).toBe(false);

    expect([...before].toSorted()).toStrictEqual(
      AREAS.map((area) => `${area}: fundamentos`).toSorted(),
    );

    const initial = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { phase: "asc" } } },
      where: { id: plan.id },
    });

    const funding = parsePlanSettings(initial.settings).mockFunding;
    expect(funding).toHaveLength(1);
    expect(funding[0]).toMatchObject({ date: "2020-10-09", minutes: 15 });

    expect(initial.items.filter((item) => item.kind === "mock")).toMatchObject([
      { scheduledFor: new Date("2020-10-09") },
    ]);

    expect(
      initial.items
        .filter((item) => item.kind === "boss")
        .map((item) => [item.phase, item.scheduledFor?.toISOString().slice(0, 10)]),
    ).toStrictEqual([
      [0, "2020-10-01"],
      [1, "2020-10-06"],
      [2, "2020-10-08"],
    ]);

    if (!known) {
      throw new Error("The library has no skills.");
    }

    const { items } = await loadGoalPlan(goal.id);

    await markPlanItemsTestedOut({
      goalId: goal.id,
      items,
      knownSkillIds: new Set([known.id]),
      testedOutAt: NOW,
      timeZone: "UTC",
    });

    const after = await plannedTopics({ library, planId: plan.id });

    expect(difference(after, before)).toStrictEqual(["Matemática: aplicação"]);

    await expect(readChange({ kind: "testedOut", planId: plan.id })).resolves.toStrictEqual({
      added: ["Matemática: aplicação"],
      leftOut: [],
    });
  });

  it("names the topics missed days leave out of the plan", async () => {
    const { goal, library, plan } = await setup({ dailyMinutes: 11, daysAway: 14 });
    const before = await plannedTopics({ library, planId: plan.id });

    vi.setSystemTime(new Date("2020-10-02T12:00:00Z"));
    await refreshGoalPlan({ goalId: goal.id });

    const after = await plannedTopics({ library, planId: plan.id });
    const leftOut = difference(before, after);

    expect(leftOut.length).toBeGreaterThan(0);

    await expect(readChange({ kind: "missedDays", planId: plan.id })).resolves.toStrictEqual({
      added: difference(after, before),
      leftOut,
    });
  });

  it("names the topics a goal back from a pause leaves out of the plan", async () => {
    const { goal, library, plan } = await setup({ dailyMinutes: 11, daysAway: 14 });
    const before = await plannedTopics({ library, planId: plan.id });

    await updateGoal({ goalId: goal.id, input: { status: "paused" } });
    vi.setSystemTime(new Date("2020-10-02T12:00:00Z"));
    await updateGoal({ goalId: goal.id, input: { status: "active" } });

    const after = await plannedTopics({ library, planId: plan.id });
    const leftOut = difference(before, after);

    expect(leftOut.length).toBeGreaterThan(0);

    await expect(readChange({ kind: "resumed", planId: plan.id })).resolves.toStrictEqual({
      added: difference(after, before),
      leftOut,
    });
  });
});

describe("an exam plan planned again with nothing new", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps its mock funding when planned again with nothing new", async () => {
    const { goal, plan } = await setup({
      dailyMinutes: 9,
      daysAway: 14,
      lessonMinutes: 7,
      mockMinutes: 30,
    });

    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await expect(refreshGoalPlan({ goalId: goal.id, pace: "saved" })).resolves.toStrictEqual({
      status: "unchanged",
    });

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(after.version).toBe(before.version);

    expect(parsePlanSettings(after.settings).mockFunding).toStrictEqual(
      parsePlanSettings(before.settings).mockFunding,
    );
  });
});
