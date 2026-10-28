import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  ENGLISH_II,
  FOREIGN_LANGUAGE,
  FRENCH,
  HISTORY,
  PHILOSOPHY,
  SPANISH_HISTORY,
  twoChoiceBlueprintFixture,
} from "../exams/choices/_test-utils/choice-blueprint";
import { chooseExamOption } from "../exams/choices/choose-exam-option";
import { getMock } from "../exams/mocks/get-mock";
import { startAnytimeMock } from "../exams/mocks/start-anytime-mock";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { type PlanGraph, parsePlanGraph } from "./planner/plan-state";

/** A Monday in 2020, before other tests' learning events, so pace estimates stay out of it. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TIME_ZONE = "Europe/Madrid";
const CASTELLANA = "Lengua Castellana y Literatura II";

const AREAS = [CASTELLANA, SPANISH_HISTORY, PHILOSOPHY, ENGLISH_II, FRENCH];

async function setup({ options = true }: { options?: boolean } = {}) {
  const [user, blueprint] = await Promise.all([userFixture(), twoChoiceBlueprintFixture()]);

  const library = await planLibraryFixture({
    skills: AREAS.map((area) => ({ area, lessons: area === CASTELLANA ? 2 : 1 })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    examBlueprintId: blueprint.id,
    kind: "exam",
    language: "es",
    settings: { startDate: "2020-09-28" },
    timezone: TIME_ZONE,
    userId: user.id,
  });

  const graph: PlanGraph = options
    ? library.graph
    : {
        ...library.graph,
        skills: library.graph.skills.filter((skill) => skill.area === CASTELLANA),
      };

  if (!options) {
    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: NOW,
        graph: library.graph,
        model: "test",
        promptVersion: "test",
        runId: crypto.randomUUID(),
      },
    });
  }

  await createGoalPlan({ goalId: goal.id, graph });
  mockSession(user.id);

  const areaOf = new Map(library.graph.skills.map((skill) => [skill.skillId, skill.area]));
  return { areaOf, blueprint, goal, library, plan, user };
}

async function loadPlannedAreas({
  areaOf,
  planId,
}: {
  areaOf: ReadonlyMap<string, string | null>;
  planId: string;
}): Promise<string[]> {
  const items = await prisma.planItem.findMany({
    select: { skillId: true },
    where: { kind: "lesson", planId, status: "todo" },
  });

  const areas = new Set(items.map((item) => areaOf.get(item.skillId ?? "")));
  return AREAS.filter((area) => areas.has(area));
}

async function loadGraphAreas(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const graph = parsePlanGraph(plan.graph);

  return {
    aside: (graph.optionSkills ?? []).map((skill) => skill.area),
    studied: graph.skills.map((skill) => skill.area),
  };
}

function pick({ goalId, subject }: { goalId: string; subject: string }) {
  const group = subject === SPANISH_HISTORY || subject === PHILOSOPHY ? HISTORY : FOREIGN_LANGUAGE;
  return chooseExamOption({ goalId, input: { group, subject, timeZone: TIME_ZONE } });
}

function namedAreas(result: Awaited<ReturnType<typeof chooseExamOption>>) {
  const effect = result.status === "applied" ? result.change?.effect : null;

  return {
    added: (effect?.topicsAdded ?? []).map((topics) => topics.area),
    leftOut: (effect?.topicsLeftOut ?? []).map((topics) => topics.area),
  };
}

describe("plans of an exam with choices of subject", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("study no option of a choice the learner hasn't picked yet", async () => {
    const { areaOf, plan } = await setup();

    await expect(loadPlannedAreas({ areaOf, planId: plan.id })).resolves.toStrictEqual([
      CASTELLANA,
    ]);

    await expect(loadGraphAreas(plan.id)).resolves.toStrictEqual({
      aside: [SPANISH_HISTORY, PHILOSOPHY, ENGLISH_II, FRENCH],
      studied: [CASTELLANA],
    });
  });

  it("bring a picked option's lessons in, named, and swap them when the pick changes", async () => {
    const { areaOf, goal, plan } = await setup();

    const french = await pick({ goalId: goal.id, subject: FRENCH });
    expect(namedAreas(french)).toStrictEqual({ added: [FRENCH], leftOut: [] });

    const philosophy = await pick({ goalId: goal.id, subject: PHILOSOPHY });
    expect(namedAreas(philosophy)).toStrictEqual({ added: [PHILOSOPHY], leftOut: [] });

    await expect(loadPlannedAreas({ areaOf, planId: plan.id })).resolves.toStrictEqual([
      CASTELLANA,
      PHILOSOPHY,
      FRENCH,
    ]);

    const history = await pick({ goalId: goal.id, subject: SPANISH_HISTORY });

    expect(namedAreas(history)).toStrictEqual({ added: [SPANISH_HISTORY], leftOut: [PHILOSOPHY] });

    await expect(loadPlannedAreas({ areaOf, planId: plan.id })).resolves.toStrictEqual([
      CASTELLANA,
      SPANISH_HISTORY,
      FRENCH,
    ]);

    await expect(loadGraphAreas(plan.id)).resolves.toStrictEqual({
      aside: [PHILOSOPHY, ENGLISH_II],
      studied: [CASTELLANA, SPANISH_HISTORY, FRENCH],
    });

    await decidePlanChange({
      changeId: history.status === "applied" ? (history.change?.id ?? "") : "",
      goalId: goal.id,
      input: { status: "undone", timeZone: TIME_ZONE },
    });

    await expect(loadPlannedAreas({ areaOf, planId: plan.id })).resolves.toStrictEqual([
      CASTELLANA,
      PHILOSOPHY,
      FRENCH,
    ]);
  });

  it("take a picked option from the exam's shared graph when the plan never had it", async () => {
    const { areaOf, goal, plan } = await setup({ options: false });

    const result = await pick({ goalId: goal.id, subject: ENGLISH_II });
    expect(namedAreas(result)).toStrictEqual({ added: [ENGLISH_II], leftOut: [] });

    await expect(loadPlannedAreas({ areaOf, planId: plan.id })).resolves.toStrictEqual([
      CASTELLANA,
      ENGLISH_II,
    ]);

    await expect(loadGraphAreas(plan.id)).resolves.toStrictEqual({
      aside: [],
      studied: [CASTELLANA, ENGLISH_II],
    });
  });

  it("ask a mock only of the options the learner picked", async () => {
    const { areaOf, blueprint, goal, library, user } = await setup();

    await pick({ goalId: goal.id, subject: PHILOSOPHY });
    await pick({ goalId: goal.id, subject: ENGLISH_II });

    await Promise.all([
      ...library.graph.skills.flatMap((skill) =>
        Array.from({ length: 3 }, () =>
          itemFixture({
            content: choiceItemContent(),
            examBlueprintId: blueprint.id,
            language: "es",
            skillId: skill.skillId,
          }),
        ),
      ),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { acceptFewer: true, shape: { area: null, day: 1, kind: "full" } },
    });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    const mock = await getMock(started.id);
    const asked = mock.status === "ready" ? (mock.mock.current?.questions ?? []) : [];

    const items = await prisma.item.findMany({
      select: { skillId: true },
      where: { id: { in: asked.map((question) => question.itemId) } },
    });

    const counts = Object.fromEntries(
      AREAS.map((area) => [
        area,
        items.filter((item) => areaOf.get(item.skillId ?? "") === area).length,
      ]),
    );

    expect(counts).toStrictEqual({
      [CASTELLANA]: 2,
      [ENGLISH_II]: 2,
      [FRENCH]: 0,
      [PHILOSOPHY]: 2,
      [SPANISH_HISTORY]: 0,
    });
  });
});
