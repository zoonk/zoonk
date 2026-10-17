import { randomUUID } from "node:crypto";
import { type PlanItem, prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { readSelectedItemFacts } from "../plans/_utils/selected-item-contract";
import { getItemKey } from "../plans/planner/plan-items";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { seedV2PersonaCopy } from "../seed/seed-v2";
import { moveChallenge } from "./move-challenge";

/** Ana's Friday: her next mock, a long one the plan saves time for, sits Sunday Nov 8. */
const FRIDAY = new Date("2026-10-16T20:52:12Z");
const SUNDAY = "2026-11-08";
const MONDAY = "2026-11-09";

/** The days a todo lesson's time sits on, as the plan saved it. */
function teachingDays(item: PlanItem): string[] {
  const days = readSelectedItemFacts(item.facts)?.days?.map(([date]) => date);
  return days ?? (item.scheduledFor ? [item.scheduledFor.toISOString().slice(0, 10)] : []);
}

async function readPlan(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ include: { items: true }, where: { goalId } });
  const lessons = plan.items.filter((item) => item.kind === "lesson" && item.status === "todo");
  return { funding: parsePlanSettings(plan.settings).mockFunding, lessons, plan };
}

describe("moving a funded mock to Monday", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRIDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves Ana's Sunday mock with its saved time, and Monday's lessons go to later days in order", async () => {
    const copyKey = randomUUID().slice(0, 8);

    const copy = await seedV2PersonaCopy({
      copyKey,
      email: `move-funded-mock-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    const before = await readPlan(copy.goalId);

    const mock = before.plan.items.find(
      (item) =>
        item.kind === "mock" &&
        item.status === "todo" &&
        item.scheduledFor?.toISOString().slice(0, 10) === SUNDAY,
    );

    const nextMock = before.funding.map((entry) => entry.date).find((date) => date > MONDAY);

    // Monday holds lessons the mock needs the day for, and the time Monday saves for a later mock.
    expect(before.lessons.some((item) => teachingDays(item).includes(MONDAY))).toBe(true);
    expect(nextMock).toBeDefined();

    mockSession(copy.userId);

    const moved = await moveChallenge({
      input: { timeZone: "America/Sao_Paulo" },
      planItemId: mock?.id ?? "",
    });

    expect(moved).toMatchObject({ move: { date: MONDAY }, status: "moved" });

    const after = await readPlan(copy.goalId);
    const movedId = moved.status === "moved" ? moved.move.planItemId : null;

    expect(after.plan.items.find((item) => item.id === movedId)).toMatchObject({
      kind: "mock",
      scheduledFor: new Date(`${MONDAY}T00:00:00Z`),
      status: "todo",
    });

    // The time the plan saved for it moved with it.
    expect(after.funding.find((entry) => entry.date === MONDAY)?.minutes).toBe(165);
    expect(after.funding.some((entry) => entry.date === SUNDAY)).toBe(false);

    // Nothing is lost: every lesson is still planned, none on the mock's day, and the ones that
    // moved still come before the next mock that tests them.
    expect(after.lessons.map((item) => getItemKey(item)).toSorted()).toStrictEqual(
      before.lessons.map((item) => getItemKey(item)).toSorted(),
    );

    expect(after.lessons.filter((item) => teachingDays(item).includes(MONDAY))).toStrictEqual([]);

    const savedDays = new Map(before.lessons.map((item) => [getItemKey(item), teachingDays(item)]));

    const newDays = after.lessons.flatMap((item) =>
      teachingDays(item).filter((date) => !savedDays.get(getItemKey(item))?.includes(date)),
    );

    expect(newDays.length).toBeGreaterThan(0);
    expect(newDays.every((date) => date < (nextMock ?? ""))).toBe(true);
  });

  // With her exam on the Tuesday, Monday's lessons had no later day before it to go to, and the
  // screen said "Try again in a moment" for a move the plan can only refuse again.
  it("refuses Ana's mock when no day before her exam has room for Monday's lessons, saying why", async () => {
    const copyKey = randomUUID().slice(0, 8);

    const copy = await seedV2PersonaCopy({
      copyKey,
      email: `move-funded-mock-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    await prisma.goal.update({
      data: { targetDate: new Date("2026-11-10T00:00:00Z") },
      where: { id: copy.goalId },
    });

    const before = await readPlan(copy.goalId);

    const mock = before.plan.items.find(
      (item) =>
        item.kind === "mock" &&
        item.status === "todo" &&
        item.scheduledFor?.toISOString().slice(0, 10) === SUNDAY,
    );

    mockSession(copy.userId);

    const moved = await moveChallenge({
      input: { timeZone: "America/Sao_Paulo" },
      planItemId: mock?.id ?? "",
    });

    expect(moved).toStrictEqual({
      error: "unfundedMove",
      status: "invalid",
      unfundedMove: { date: MONDAY, minutes: mock?.minutes },
    });

    await expect(readPlan(copy.goalId)).resolves.toStrictEqual(before);
  });
});
