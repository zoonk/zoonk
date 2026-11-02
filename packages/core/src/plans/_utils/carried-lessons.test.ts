import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadPlanCarryOver, wasLastDayStudied } from "./carried-lessons";

const TODAY = new Date("2026-10-13T00:00:00Z");

async function setup() {
  const user = await userFixture();
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  const context = { goal, plan, timeZone: "UTC", today: TODAY };

  return { context, goal, plan };
}

describe(loadPlanCarryOver, () => {
  it("carries again what the day's settling carried, on every later run that day", async () => {
    const { context, plan } = await setup();

    await planChangeFixture({
      createdAt: new Date("2026-10-13T09:00:00Z"),
      kind: "missedDays",
      payload: { carriedItemIds: ["left-1", "left-2"], source: "system" },
      planId: plan.id,
    });

    await expect(loadPlanCarryOver({ context, mode: "automatic" })).resolves.toStrictEqual({
      itemIds: ["left-1", "left-2"],
      lessonIds: [],
    });

    await expect(loadPlanCarryOver({ context, mode: "forced" })).resolves.toStrictEqual({
      itemIds: ["left-1", "left-2"],
      lessonIds: [],
    });
  });

  it("carries the steering of the day's last change on every later run that day", async () => {
    const { context, plan } = await setup();

    await planChangeFixture({
      createdAt: new Date("2026-10-13T09:00:00Z"),
      kind: "edited",
      payload: {
        operations: [
          { areas: ["Civil law"], kind: "focusAreas" },
          { areas: ["Ethics"], kind: "reduceAreas" },
        ],
        source: "learner",
      },
      planId: plan.id,
    });

    await expect(loadPlanCarryOver({ context, mode: "automatic" })).resolves.toStrictEqual({
      itemIds: [],
      lessonIds: [],
      todayExceptAreas: ["Ethics"],
    });
  });

  it("carries no steering once a later change that day plans today again", async () => {
    const { context, plan } = await setup();

    await planChangeFixture({
      createdAt: new Date("2026-10-13T09:00:00Z"),
      kind: "edited",
      payload: { operations: [{ areas: ["Civil law"], kind: "focusAreas" }], source: "learner" },
      planId: plan.id,
    });

    await planChangeFixture({
      createdAt: new Date("2026-10-13T10:00:00Z"),
      kind: "edited",
      payload: { operations: [{ kind: "setDailyMinutes", minutes: 30 }], source: "learner" },
      planId: plan.id,
    });

    await expect(loadPlanCarryOver({ context, mode: "automatic" })).resolves.toBeNull();
  });

  it("carries no steering from an undone change or another day's", async () => {
    const { context, plan } = await setup();

    await planChangeFixture({
      createdAt: new Date("2026-10-12T09:00:00Z"),
      kind: "edited",
      payload: { operations: [{ areas: ["Civil law"], kind: "focusAreas" }], source: "learner" },
      planId: plan.id,
    });

    await planChangeFixture({
      createdAt: new Date("2026-10-13T09:00:00Z"),
      kind: "edited",
      payload: { operations: [{ areas: ["Ethics"], kind: "focusAreas" }], source: "learner" },
      planId: plan.id,
      status: "undone",
    });

    await expect(loadPlanCarryOver({ context, mode: "automatic" })).resolves.toBeNull();
  });

  it("carries nothing on an automatic run of a day that settled nothing", async () => {
    const { context, plan } = await setup();

    await planChangeFixture({
      createdAt: new Date("2026-10-12T09:00:00Z"),
      kind: "missedDays",
      payload: { carriedItemIds: ["yesterday"], source: "system" },
      planId: plan.id,
    });

    await expect(loadPlanCarryOver({ context, mode: "automatic" })).resolves.toBeNull();

    await expect(loadPlanCarryOver({ context, mode: "forced" })).resolves.toStrictEqual({
      itemIds: [],
      lessonIds: [],
    });
  });

  it("carries nothing the day's settling carried once a change after it laid the plan out", async () => {
    const { context, plan } = await setup();

    await planChangeFixture({
      createdAt: new Date("2026-10-13T09:00:00Z"),
      kind: "missedDays",
      payload: { carriedItemIds: ["left-1", "left-2"], source: "system" },
      planId: plan.id,
    });

    await planChangeFixture({
      createdAt: new Date("2026-10-13T10:00:00Z"),
      kind: "edited",
      payload: {
        operations: [{ bias: "moreExplanation", kind: "setPracticeBias" }],
        source: "learner",
      },
      planId: plan.id,
    });

    await expect(loadPlanCarryOver({ context, mode: "automatic" })).resolves.toBeNull();
  });
});

describe(wasLastDayStudied, () => {
  const yesterday = new Date("2026-10-12T00:00:00Z");

  const review = {
    chapterId: null,
    completedAt: null,
    id: "review",
    kind: "review" as const,
    lessonId: null,
    phase: 0,
    position: 0,
    scheduledFor: yesterday,
    skillId: null,
    status: "todo" as const,
    titleSnapshot: "Review",
  };

  it("counts a review day the learner did as studied", async () => {
    const { context, goal } = await setup();

    await studySessionFixture({ goalId: goal.id, localDate: yesterday, userId: goal.userId });

    const done = {
      ...review,
      completedAt: new Date("2026-10-12T15:00:00Z"),
      status: "done" as const,
    };

    await expect(wasLastDayStudied({ ...context, items: [done] })).resolves.toBe(true);
  });

  it("counts a review day left undone as missed", async () => {
    const { context, goal } = await setup();

    await studySessionFixture({ goalId: goal.id, localDate: yesterday, userId: goal.userId });

    await expect(wasLastDayStudied({ ...context, items: [review] })).resolves.toBe(false);
  });
});
