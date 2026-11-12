import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { adaptPlanFromMock } from "../../exams/mocks/adapt-plan-from-mock";
import { mockConditionsSchema } from "../../exams/mocks/mock-contract";
import {
  parsePlanChangePayload,
  toPlanChangePayload,
} from "../../plans/_utils/plan-change-payload";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { proposePlanChange } from "../../plans/propose-plan-change";
import { rebalancePlanAfterSession } from "../../preparation/rebalance-plan";
import { PLAN_SHOWN, shortPlanExamGoalFixture } from "../_test-utils/exam-test-goal";
import * as testSitting from "./_utils/test-sitting";
import { readFocusTestRecord } from "./focus-test-state";
import { getGoalPlacement } from "./get-goal-placement";

async function setup(
  source: "focusTest" | "learner" | "mock" | "preparation" = "focusTest",
  {
    summary = "saved",
    testAnswers = true,
  }: { summary?: "none" | "saved"; testAnswers?: boolean } = {},
) {
  const fixture = await shortPlanExamGoalFixture({
    daysLeft: 60,
    goal: { ...PLAN_SHOWN, createdAt: new Date(Date.now() - 15 * MS_PER_DAY), timezone: "UTC" },
    lessons: 30,
  });

  const { goal, plan, user } = fixture;
  const areas = ["Direito"];

  const changed =
    source === "focusTest" || source === "preparation"
      ? await proposePlanChange({
          approval: "always",
          goalId: goal.id,
          operations: [{ areas, kind: "focusAreas" }],
          reason: "",
          source,
        })
      : null;

  if (changed?.status === "proposed") {
    await decidePlanChange({
      changeId: changed.changeId,
      goalId: goal.id,
      input: { status: "applied" },
    });
  } else if (source === "learner") {
    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas, kind: "focusAreas" }] },
      trackAnalytics: false,
    });
  } else if (source === "mock") {
    const conditions = mockConditionsSchema.parse({
      day: null,
      examQuestions: null,
      fullLength: true,
      partialCredit: "allOrNothing",
      purpose: "practice",
      reused: 0,
      scoring: "raw",
      sections: [],
      shape: null,
      startTime: null,
      timeZone: "UTC",
      timedOutSections: [],
      wrongPenalty: 0,
    });

    const mock = await prisma.mockExam.create({
      data: {
        conditions,
        finishedAt: new Date(),
        goalId: goal.id,
        result: {
          areas: ["Direito", "Português", "Informática", "Raciocínio", "Atualidades", "Ética"].map(
            (name) => ({
              correct: name === "Direito" ? 0 : 6,
              name,
              score: null,
              secondsPerQuestion: 60,
              targetSecondsPerQuestion: null,
              total: 6,
            }),
          ),
          blank: 0,
          calibration: null,
          coherence: null,
          correct: 30,
          irt: null,
          minutesUsed: 36,
          net: null,
          plannedMinutes: 36,
          preparation: null,
          previous: null,
          scoring: "raw",
          topics: [],
          total: 36,
          unansweredAtTimeout: 0,
        },
        sectionStartedAt: new Date(),
        status: "finished",
        userId: user.id,
      },
    });

    const accepted = await adaptPlanFromMock({
      blockId: mock.id,
      input: { offer: "focus", timeZone: "UTC" },
    });

    if (accepted.status !== "applied") {
      throw new Error("The mock focus was not accepted");
    }
  }

  await expect(
    prisma.plan
      .findUniqueOrThrow({ where: { id: plan.id } })
      .then((row) => parsePlanSettings(row.settings).focusAreas),
  ).resolves.toStrictEqual(areas);

  await prisma.planChange.updateMany({
    data: { createdAt: new Date(Date.now() - 8 * MS_PER_DAY) },
    where: { planId: plan.id },
  });

  const graph = parsePlanGraph(plan.graph);
  const items = await prisma.item.findMany({ where: { examBlueprintId: goal.examBlueprintId } });

  const right = items.find(
    (item) =>
      item.skillId &&
      item.skillId === graph.skills.find((skill) => skill.area === "Direito")?.skillId,
  )!;

  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

  if (testAnswers) {
    await attemptFixture({
      isCorrect: true,
      isPlacement: true,
      itemId: right.id,
      skillId: right.skillId,
      userId: user.id,
    });
  }

  await Promise.all(
    Array.from({ length: 12 }, () =>
      attemptFixture({
        isCorrect: true,
        itemId: right.id,
        skillId: right.skillId,
        studySessionId: session.id,
        userId: user.id,
      }),
    ),
  );

  if (summary === "none") {
    await prisma.goal.update({ data: { details: PLAN_SHOWN.details }, where: { id: goal.id } });
  } else if (testAnswers) {
    await testSitting.saveTestSummary({ goalId: goal.id, userId: user.id });
  }

  return fixture;
}

async function proposals(planId: string) {
  return prisma.planChange.findMany({
    where: { payload: { equals: "focusTest", path: ["source"] }, planId, status: "proposed" },
  });
}

describe("weekly reviews of a system-owned focus", () => {
  it.each(["preparation", "mock"] as const)(
    "rechecks an older learner's %s focus without a saved test record",
    async (source) => {
      const { goal, plan, user } = await setup(source, { summary: "none" });
      const before = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      expect(readFocusTestRecord(before)).toBeNull();

      await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
      await expect(proposals(plan.id)).resolves.toHaveLength(1);

      const after = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      expect(readFocusTestRecord(after)).toMatchObject({ summary: { asked: 1 } });
    },
  );

  it("recounts an older goal once before recording that it has no test answers", async () => {
    const { goal, plan, user } = await setup("preparation", {
      summary: "none",
      testAnswers: false,
    });

    const summary = vi.spyOn(testSitting, "saveTestSummary");

    try {
      await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
      await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
      await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
      expect(summary).toHaveBeenCalledOnce();
      await expect(proposals(plan.id)).resolves.toHaveLength(0);

      const after = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      expect(readFocusTestRecord(after)).toMatchObject({ summary: { asked: 0 } });
    } finally {
      summary.mockRestore();
    }
  });

  it("does not recount a test with no answered subject on repeated settlements", async () => {
    const { goal, plan, user } = await setup("mock", { testAnswers: false });
    const summary = vi.spyOn(testSitting, "saveTestSummary");

    try {
      await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
      await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
      await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
      expect(summary).not.toHaveBeenCalled();
      await expect(proposals(plan.id)).resolves.toHaveLength(0);
    } finally {
      summary.mockRestore();
    }
  });

  it.each(["focusTest", "mock"] as const)(
    "proposes from ordinary practice after accepting a %s focus",
    async (source) => {
      const { goal, plan, user } = await setup(source);
      await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
      const waiting = await proposals(plan.id);
      expect(waiting).toHaveLength(1);

      expect(waiting[0]?.payload).toMatchObject({
        operations: [{ areas: ["Português", "Informática"], kind: "focusAreas" }],
        source: "focusTest",
      });
    },
  );

  it("leaves a learner's own focus alone", async () => {
    const { goal, plan, user } = await setup("learner");
    await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
    await expect(proposals(plan.id)).resolves.toHaveLength(0);
  });

  it("does not recount the test while a week-old proposal is waiting", async () => {
    const { goal, plan, user } = await setup();
    await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
    const [waiting] = await proposals(plan.id);
    expect(waiting).toBeDefined();

    await prisma.planChange.update({
      data: { createdAt: new Date(Date.now() - 8 * MS_PER_DAY) },
      where: { id: waiting!.id },
    });

    const summary = vi.spyOn(testSitting, "saveTestSummary");

    try {
      await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
      expect(summary).not.toHaveBeenCalled();
    } finally {
      summary.mockRestore();
    }
  });

  it("keeps one waiting proposal under concurrent settlements and never repeats a declined set", async () => {
    const { goal, plan, user } = await setup();

    await Promise.all([
      rebalancePlanAfterSession({ goalId: goal.id, userId: user.id }),
      rebalancePlanAfterSession({ goalId: goal.id, userId: user.id }),
    ]);

    const waiting = await proposals(plan.id);
    expect(waiting).toHaveLength(1);

    await decidePlanChange({
      changeId: waiting[0]!.id,
      goalId: goal.id,
      input: { status: "declined" },
    });

    await prisma.planChange.updateMany({
      data: { createdAt: new Date(Date.now() - 8 * MS_PER_DAY) },
      where: { planId: plan.id },
    });

    await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
    await expect(proposals(plan.id)).resolves.toHaveLength(0);
  });

  it("waits seven days and does not propose from a GET", async () => {
    const { goal, plan, user } = await setup();

    await prisma.planChange.updateMany({
      data: { createdAt: new Date(Date.now() - 6 * MS_PER_DAY) },
      where: { planId: plan.id },
    });

    await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
    await getGoalPlacement({ goalId: goal.id });
    await expect(proposals(plan.id)).resolves.toHaveLength(0);
  });

  it("offers Update and Undo through the existing proposal and never repeats the undone set", async () => {
    const { goal, plan, user } = await setup();
    await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
    const [proposal] = await proposals(plan.id);
    expect(proposal).toBeDefined();

    await expect(
      decidePlanChange({ changeId: proposal!.id, goalId: goal.id, input: { status: "applied" } }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(
      decidePlanChange({ changeId: proposal!.id, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ status: "updated" });

    const restored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(restored.settings).focusAreas).toStrictEqual(["Direito"]);

    await prisma.planChange.updateMany({
      data: { createdAt: new Date(Date.now() - 8 * MS_PER_DAY) },
      where: { planId: plan.id },
    });

    await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
    await expect(proposals(plan.id)).resolves.toHaveLength(0);
  });

  it("keeps historic learner-source changes protected instead of guessing their origin", async () => {
    const { goal, plan, user } = await setup("mock");

    const accepted = await prisma.planChange.findFirstOrThrow({
      orderBy: { createdAt: "desc" },
      where: { planId: plan.id, status: "applied" },
    });

    await prisma.planChange.update({
      data: {
        payload: toPlanChangePayload({
          ...parsePlanChangePayload(accepted.payload),
          source: "learner",
        }),
      },
      where: { id: accepted.id },
    });

    await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });
    await expect(proposals(plan.id)).resolves.toHaveLength(0);
  });
});
