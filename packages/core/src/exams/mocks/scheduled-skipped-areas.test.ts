import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import {
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { listMockPrepWrites } from "./prepare-mock-questions";
import { startMock } from "./start-mock";

const CITATION = { passage: "From the notice.", sourceId: "source" };
const AREAS = ["Mathematics", "Languages"] as const;

const STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: AREAS.map((name) => ({
      day: null,
      kind: "objective",
      minutes: 12,
      name,
      questions: 8,
    })),
    timeLimitMinutes: 24,
    totalQuestions: 16,
  },
  rules: [],
  subjects: AREAS.map((name) => ({
    citation: CITATION,
    name,
    questions: 8,
    topics: [],
    weight: null,
  })),
};

async function setup({ skippedAreas }: { skippedAreas: string[] }) {
  const user = await userFixture();
  const blueprint = await examBlueprintFixture({ structure: STRUCTURE });

  const fixture = await sessionGoalFixture({
    goal: { dailyMinutes: 60, examBlueprintId: blueprint.id, kind: "exam" },
    itemsPerSkill: 12,
    lessons: 4,
    userId: user.id,
  });

  const graph = parsePlanGraph(fixture.plan.graph);

  await prisma.plan.update({
    data: {
      graph: {
        ...graph,
        skills: graph.skills.map((skill, index) => ({ ...skill, area: AREAS[index < 2 ? 0 : 1] })),
      },
      settings: { skippedAreas },
    },
    where: { id: fixture.plan.id },
  });

  await prisma.item.updateMany({
    data: { examBlueprintId: blueprint.id, mockOnly: true },
    where: { skillId: { in: fixture.skills.map((skill) => skill.id) } },
  });

  await Promise.all([
    checkpointItemFixture({
      kind: "mock",
      planId: fixture.plan.id,
      position: 10,
      scheduledFor: SESSION_TODAY,
    }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  const today = await getTodayStudySession({ goalId: fixture.goal.id });
  const blocks = today.status === "ready" ? today.session.blocks : [];
  const block = blocks.find((candidate) => candidate.checkpoint?.mock);

  if (!block) {
    throw new Error("Expected a scheduled mock");
  }

  return { ...fixture, block };
}

describe("a scheduled mock for a learner who took a subject out of the plan", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("asks for the retained subject when the scheduled start is short", async () => {
    const { block, goal, skills } = await setup({ skippedAreas: ["Languages"] });
    const retained = skills.slice(0, 2).map((skill) => skill.id);

    await prisma.item.updateMany({
      data: { retiredAt: SESSION_NOW },
      where: { skillId: { in: retained } },
    });

    await expect(startMock({ blockId: block.id, input: {} })).resolves.toMatchObject({
      status: "preparing",
    });

    const supply = await listMockPrepWrites({ goalId: goal.id });
    expect(supply.urgentShort).toBe(true);

    expect(supply.writes.flatMap((write) => write.skillIds)).toStrictEqual(
      expect.arrayContaining(retained),
    );
  });

  it("starts the scheduled paper with only retained subjects", async () => {
    const { block, goal } = await setup({ skippedAreas: ["Languages"] });

    await expect(listMockPrepWrites({ goalId: goal.id })).resolves.toMatchObject({
      urgentShort: false,
    });

    expect(block).toMatchObject({ preparing: false, questions: 4 });

    await expect(startMock({ blockId: block.id, input: {} })).resolves.toMatchObject({
      status: "ready",
    });
  });
});
