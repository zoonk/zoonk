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

const FRIDAY = new Date("2026-10-16T20:52:12Z");
const SUNDAY = "2026-11-08";
const MONDAY = "2026-11-09";
const THIS_SUNDAY = "2026-10-18";

function toDay(item: PlanItem): string {
  return item.scheduledFor?.toISOString().slice(0, 10) ?? "";
}

function thisWeek(date: string): boolean {
  return date <= THIS_SUNDAY;
}

function week(items: PlanItem[]): string[] {
  return items
    .filter((item) => item.status === "todo" && item.scheduledFor && thisWeek(toDay(item)))
    .map((item) => `${getItemKey(item)}@${toDay(item)}`)
    .toSorted();
}

function layout(items: PlanItem[]): string[] {
  return items
    .map((item) => `${getItemKey(item)}@${item.scheduledFor ? toDay(item) : ""}:${item.status}`)
    .toSorted();
}

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

    const saved = before.funding.find((entry) => entry.date === SUNDAY);
    const funded = after.funding.find((entry) => entry.date === MONDAY);

    expect(funded).toMatchObject({ day: saved?.day, minutes: 165 });
    expect(after.funding.some((entry) => entry.date === SUNDAY)).toBe(false);

    expect(funded?.contributions.filter((part) => thisWeek(part.date))).toStrictEqual(
      saved?.contributions.filter((part) => thisWeek(part.date)),
    );

    expect(week(after.plan.items)).toStrictEqual(week(before.plan.items));

    expect(after.lessons.filter((item) => teachingDays(item).includes(MONDAY))).toStrictEqual([]);

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
