import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { adaptPlanFromMock } from "../../exams/mocks/adapt-plan-from-mock";
import { mockConditionsSchema } from "../../exams/mocks/mock-contract";
import { loadPlanChangeView } from "../../plans/_utils/owned-plan";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { rebalancePlanAfterSession } from "../../preparation/rebalance-plan";
import { PLAN_SHOWN, shortPlanExamGoalFixture } from "../_test-utils/exam-test-goal";

async function goalFixture() {
  return shortPlanExamGoalFixture({
    daysLeft: 60,
    goal: { ...PLAN_SHOWN, createdAt: new Date(Date.now() - 15 * MS_PER_DAY), timezone: "UTC" },
    lessons: 30,
  });
}

async function acceptMockFocus({ goalId, userId }: { goalId: string; userId: string }) {
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
      goalId,
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
      userId,
    },
  });

  const accepted = await adaptPlanFromMock({
    blockId: mock.id,
    input: { offer: "focus", timeZone: "UTC" },
  });

  if (accepted.status !== "applied" || !accepted.changeId) {
    throw new Error("The mock focus was not accepted");
  }

  return accepted.changeId;
}

describe("a focus accepted from a mock", () => {
  it("words its plan change like the learner's own change", async () => {
    const { goal, user } = await goalFixture();

    const changeId = await acceptMockFocus({ goalId: goal.id, userId: user.id });
    const view = await loadPlanChangeView(changeId);

    expect(view.source).toBe("mock");
    expect(view.reason).toBeNull();

    const own = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas: ["Ética"], kind: "focusAreas" }] },
      trackAnalytics: false,
    });

    const ownView = own.status === "applied" && own.change ? own.change : null;
    expect(ownView?.reason).toBeNull();
  });

  it("leaves the subject the learner picked by hand alone a week later", async () => {
    const { goal, plan, user } = await goalFixture();

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ areas: ["Ética"], kind: "focusAreas" }] },
      trackAnalytics: false,
    });

    await acceptMockFocus({ goalId: goal.id, userId: user.id });

    await expect(
      prisma.plan
        .findUniqueOrThrow({ where: { id: plan.id } })
        .then((row) => parsePlanSettings(row.settings).focusAreas),
    ).resolves.toStrictEqual(["Ética", "Direito"]);

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

    await attemptFixture({
      isCorrect: true,
      isPlacement: true,
      itemId: right.id,
      skillId: right.skillId,
      userId: user.id,
    });

    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

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

    await rebalancePlanAfterSession({ goalId: goal.id, userId: user.id });

    const waiting = await prisma.planChange.findMany({
      where: { payload: { equals: "focusTest", path: ["source"] }, planId: plan.id },
    });

    expect(
      waiting.map((change) => ({ payload: change.payload, status: change.status })),
    ).toStrictEqual([]);
  });
});
