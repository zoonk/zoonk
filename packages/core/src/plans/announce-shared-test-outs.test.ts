import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { testOutKnownPlanItems } from "../learner/_utils/test-out-known-plan-items";
import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { toBlockPayload } from "../sessions/block-payload";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";

const NOW = new Date("2020-09-28T12:00:00Z");

describe("shared test-out notices", () => {
  it("recovers a committed skip on retry without interrupting active work or deliberate practice", async () => {
    freezeClock();
    vi.setSystemTime(NOW);
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 2 }] });

    const [source, other] = await Promise.all([
      unplannedGoalFixture({ settings: { startDate: "2020-09-28" }, userId: user.id }),
      unplannedGoalFixture({ settings: { startDate: "2020-09-28" }, userId: user.id }),
    ]);

    await createGoalPlan({ goalId: source.goal.id, graph: library.graph });
    await createGoalPlan({ goalId: other.goal.id, graph: library.graph });

    const day = await studySessionFixture({
      goalId: other.goal.id,
      startedAt: NOW,
      status: "active",
      userId: user.id,
    });

    const lessonId = library.lessons[0]?.id ?? "";

    const [pending, active, replay, reinforcement] = await Promise.all([
      studySessionBlockFixture({ lessonId, position: 0, sessionId: day.id }),
      studySessionBlockFixture({
        lessonId,
        position: 1,
        sessionId: day.id,
        startedAt: NOW,
        status: "active",
      }),
      studySessionBlockFixture({
        lessonId,
        payload: toBlockPayload({ extra: true }),
        position: 2,
        sessionId: day.id,
      }),
      studySessionBlockFixture({
        lessonId,
        payload: toBlockPayload({ reinforcement: true }),
        position: 3,
        sessionId: day.id,
      }),
    ]);

    const { items } = await loadGoalPlan(source.goal.id);

    const input = {
      followToday: false,
      goalId: source.goal.id,
      items,
      knownSkillIds: new Set([library.skills[0]?.id ?? ""]),
      testedOutAt: NOW,
      timeZone: "UTC",
    };

    await writeLearnerChange({ planInputs: true, userId: user.id }, (tx) =>
      testOutKnownPlanItems(tx, input),
    );

    const retry = () => markPlanItemsTestedOut({ ...input, items: [] });
    await expect(retry()).resolves.toMatchObject({ changeId: null, planItemIds: [] });

    const notices = () =>
      prisma.planChange.findMany({ where: { kind: "testedOut", planId: other.plan.id } });

    const announced = await notices();
    expect(announced).toHaveLength(1);

    const skipped = await prisma.planItem.findMany({
      where: { planId: other.plan.id, status: "testedOut" },
    });

    expect(announced[0]?.payload).toMatchObject({
      planItemIds: expect.arrayContaining(skipped.map((item) => item.id)),
    });

    await retry();
    await expect(notices()).resolves.toStrictEqual(announced);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: pending.id } }),
    ).resolves.toMatchObject({ status: "skipped" });

    await expect(
      Promise.all(
        [active, replay, reinforcement].map((block) =>
          prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
        ),
      ),
    ).resolves.toStrictEqual([active, replay, reinforcement]);

    mockSession(user.id);

    await expect(
      decidePlanChange({
        changeId: announced[0]?.id ?? "",
        goalId: other.goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: pending.id } }),
    ).resolves.toMatchObject({ status: "pending" });
  });
});
