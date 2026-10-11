import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
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

// Planned in the queue's order instead, the first open of Today after the day's settling moved
// lessons a day later and left the last ones out by the goal's date.
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

  // A later run that day without the steering laid the plan out in the queue's order: an OAB
  // plan's first landing after a focus moved 589 items of other skills.
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
});

// A day the plan gives to reviews is studied once its review is done: read as missed, the next
// day's settling could move the phase ends the learner saw (R6, r13-sim's run25 question).
describe(wasLastDayStudied, () => {
  const yesterday = new Date("2026-10-12T00:00:00Z");

  it("counts a review day the learner did as studied", async () => {
    const { context, goal, plan } = await setup();

    await studySessionFixture({ goalId: goal.id, localDate: yesterday, userId: goal.userId });

    const review = await planItemFixture({
      completedAt: new Date("2026-10-12T15:00:00Z"),
      kind: "review",
      planId: plan.id,
      scheduledFor: yesterday,
      status: "done",
    });

    await expect(wasLastDayStudied({ ...context, items: [review] })).resolves.toBe(true);
  });

  it("counts a review day left undone as missed", async () => {
    const { context, goal, plan } = await setup();

    await studySessionFixture({ goalId: goal.id, localDate: yesterday, userId: goal.userId });

    const review = await planItemFixture({
      kind: "review",
      planId: plan.id,
      scheduledFor: yesterday,
    });

    await expect(wasLastDayStudied({ ...context, items: [review] })).resolves.toBe(false);
  });
});
