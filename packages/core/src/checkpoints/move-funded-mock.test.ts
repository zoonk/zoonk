import { randomUUID } from "node:crypto";
import { type PlanItem, prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { parsePlanChangePayload } from "../plans/_utils/plan-change-payload";
import { readSelectedItemFacts } from "../plans/_utils/selected-item-contract";
import { getItemKey } from "../plans/planner/plan-items";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { seedV2PersonaCopy } from "../seed/seed-v2";
import { moveChallenge, undoChallengeMove } from "./move-challenge";

/** Ana's Friday: her next mock, a long one the plan saves time for, sits Sunday Nov 8. */
const FRIDAY = new Date("2026-10-16T20:52:12Z");
const SUNDAY = "2026-11-08";
const MONDAY = "2026-11-09";
/** The end of the week Ana moves it in: an automatic run keeps that week as saved. */
const THIS_SUNDAY = "2026-10-18";

function toDay(item: PlanItem): string {
  return item.scheduledFor?.toISOString().slice(0, 10) ?? "";
}

function thisWeek(date: string): boolean {
  return date <= THIS_SUNDAY;
}

/** What this week holds still to do, by item and day. */
function week(items: PlanItem[]): string[] {
  return items
    .filter((item) => item.status === "todo" && item.scheduledFor && thisWeek(toDay(item)))
    .map((item) => `${getItemKey(item)}@${toDay(item)}`)
    .toSorted();
}

/** Every item with its day and status. */
function layout(items: PlanItem[]): string[] {
  return items
    .map((item) => `${getItemKey(item)}@${item.scheduledFor ? toDay(item) : ""}:${item.status}`)
    .toSorted();
}

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

  // A move re-plans as the system does (R43): this week stays as Ana saw it, the mock keeps its
  // saved credits, Monday holds the mock alone, every lesson that leaves is named on the card (R3),
  // and Undo gives back the plan she had (R38).
  it("moves Ana's Sunday mock with its saved credits, names what leaves, and undoes exactly", async () => {
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

    // Monday holds lessons the mock needs the day for.
    expect(before.lessons.some((item) => teachingDays(item).includes(MONDAY))).toBe(true);

    mockSession(copy.userId);

    const moved = await moveChallenge({
      input: { timeZone: "America/Sao_Paulo" },
      planItemId: mock?.id ?? "",
    });

    if (moved.status !== "moved" || !moved.move.planItemId || !moved.move.changeId) {
      throw new Error(`Expected Ana's mock to move, got ${moved.status}`);
    }

    expect(moved.move.date).toBe(MONDAY);

    const after = await readPlan(copy.goalId);

    expect(after.plan.items.find((item) => item.id === moved.move.planItemId)).toMatchObject({
      kind: "mock",
      scheduledFor: new Date(`${MONDAY}T00:00:00Z`),
      status: "todo",
    });

    // It keeps its exam day and the time this week and earlier days set aside for it.
    const saved = before.funding.find((entry) => entry.date === SUNDAY);
    const funded = after.funding.find((entry) => entry.date === MONDAY);

    expect(funded).toMatchObject({ day: saved?.day, minutes: 165 });
    expect(after.funding.some((entry) => entry.date === SUNDAY)).toBe(false);

    expect(funded?.contributions.filter((part) => thisWeek(part.date))).toStrictEqual(
      saved?.contributions.filter((part) => thisWeek(part.date)),
    );

    // This week stays as she saw it.
    expect(week(after.plan.items)).toStrictEqual(week(before.plan.items));

    // Monday is the mock's: no lesson's time sits on it.
    expect(after.lessons.filter((item) => teachingDays(item).includes(MONDAY))).toStrictEqual([]);

    // Every lesson the plan held is still in it, or the card names it.
    const change = await prisma.planChange.findUniqueOrThrow({
      where: { id: moved.move.changeId },
    });

    const effect = parsePlanChangePayload(change.payload).effect;
    const kept = new Set(after.lessons.map((item) => getItemKey(item)));

    const gone = before.lessons
      .filter((item) => item.lessonId && !kept.has(getItemKey(item)))
      .map((item) => item.titleSnapshot);

    expect(effect?.lessonsLeftOut ?? []).toStrictEqual(gone);

    const undone = await undoChallengeMove({
      changeId: moved.move.changeId,
      input: { timeZone: "America/Sao_Paulo" },
      planItemId: moved.move.planItemId,
    });

    expect(undone).toMatchObject({ status: "undone" });

    const restored = await readPlan(copy.goalId);

    expect(layout(restored.plan.items)).toStrictEqual(layout(before.plan.items));
    expect(restored.funding).toStrictEqual(before.funding);
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
