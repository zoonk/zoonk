import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getChallenge } from "./get-challenge";
import { moveChallenge, undoChallengeMove } from "./move-challenge";

async function setup({ mondayRests = false }: { mondayRests?: boolean } = {}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["First", "Second", "Third", "Fourth"],
    skills: Array.from({ length: 4 }, (_, phase) => ({ lessons: 12, phase })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 15,
    settings: {
      startDate: "2020-09-28",
      ...(mondayRests && { weekdayMinutes: [15, 0, 15, 15, 15, 15, 15] }),
    },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const weekly = await prisma.planItem.findFirstOrThrow({
    orderBy: { scheduledFor: "asc" },
    where: { kind: "checkpoint", planId: plan.id, scheduledFor: { gte: new Date("2020-10-18") } },
  });

  await prisma.planItem.updateMany({
    data: { completedAt: new Date("2020-10-05T10:00:00Z"), status: "done" },
    where: { kind: "lesson", phase: { lte: 1 }, planId: plan.id },
  });

  await prisma.planItem.updateMany({
    data: { completedAt: new Date("2020-10-03T10:00:00Z"), status: "done" },
    where: { kind: "boss", phase: 0, planId: plan.id },
  });

  vi.setSystemTime(new Date("2020-10-05T12:00:00Z"));
  mockSession(user.id);

  return { plan, weekly };
}

async function phaseChallenges(planId: string) {
  const items = await prisma.planItem.findMany({
    orderBy: { phase: "asc" },
    where: { kind: "boss", planId },
  });

  return items.map(({ id, phase, scheduledFor, status }) => ({ id, phase, scheduledFor, status }));
}

describe(moveChallenge, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves a future weekly challenge to its next Monday without pulling phase challenges earlier", async () => {
    const { plan, weekly } = await setup();
    const before = await phaseChallenges(plan.id);

    const moved = await moveChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id });

    expect(moved).toMatchObject({ move: { date: "2020-10-19" }, status: "moved" });
    expect(moved.status === "moved" && moved.move.planItemId).toStrictEqual(expect.any(String));

    if (moved.status !== "moved" || !moved.move.planItemId || !moved.move.changeId) {
      throw new Error("Expected the moved challenge and its Undo");
    }

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: moved.move.planItemId } }),
    ).resolves.toMatchObject({ kind: "checkpoint", scheduledFor: new Date("2020-10-19") });

    await expect(phaseChallenges(plan.id)).resolves.toStrictEqual(before);

    const undone = await undoChallengeMove({
      changeId: moved.move.changeId,
      input: { timeZone: "UTC" },
      planItemId: moved.move.planItemId,
    });

    expect(undone.status).toBe("undone");
    await expect(phaseChallenges(plan.id)).resolves.toStrictEqual(before);

    await expect(
      prisma.planItem.findUniqueOrThrow({
        where: { id: undone.status === "undone" ? (undone.planItemId ?? "") : "" },
      }),
    ).resolves.toMatchObject({ scheduledFor: weekly.scheduledFor });
  });

  it("returns what the move did to the plan, as the moved challenge's read says it", async () => {
    const { weekly } = await setup();

    const moved = await moveChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id });

    if (moved.status !== "moved" || !moved.move.planItemId || !moved.move.changeId) {
      throw new Error("Expected the moved challenge and its Undo");
    }

    const read = await getChallenge({
      input: { timeZone: "UTC" },
      movedBy: moved.move.changeId,
      planItemId: moved.move.planItemId,
    });

    expect(moved.move.effect).toStrictEqual(expect.any(Object));
    expect(read.status === "ready" && read.moved).toStrictEqual(moved.move.effect);
  });

  it("does not offer a move onto a resting Monday and refuses a stale move without writing", async () => {
    const { plan, weekly } = await setup({ mondayRests: true });

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id }),
    ).resolves.toMatchObject({ challenge: { canMove: false }, status: "ready" });

    await expect(
      moveChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id }),
    ).resolves.toStrictEqual({ error: "badMove", status: "invalid" });

    await expect(
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: plan.id },
      }),
    ).resolves.toStrictEqual(before);
  });

  it("keeps the requested challenge when its Monday is beyond the remaining work", async () => {
    const { plan, weekly } = await setup();

    await prisma.planItem.updateMany({
      data: { completedAt: new Date("2020-10-05T10:00:00Z"), status: "done" },
      where: { kind: { in: ["lesson", "boss"] }, planId: plan.id },
    });

    const moved = await moveChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id });

    expect(moved).toMatchObject({ move: { date: "2020-10-19" }, status: "moved" });
    expect(moved.status === "moved" && moved.move.planItemId).toStrictEqual(expect.any(String));

    await expect(
      prisma.planItem.findFirstOrThrow({
        where: { kind: "checkpoint", planId: plan.id, scheduledFor: new Date("2020-10-19") },
      }),
    ).resolves.toMatchObject({ status: "todo" });
  });

  it("rejects an inconsistent source day without changing the plan or losing the challenge", async () => {
    const { plan, weekly } = await setup();

    await prisma.planItem.update({
      data: { scheduledFor: new Date("2020-10-20") },
      where: { id: weekly.id },
    });

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { id: "asc" } } },
      where: { id: plan.id },
    });

    await expect(
      moveChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id }),
    ).resolves.toStrictEqual({ error: "badMove", status: "invalid" });

    await expect(
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { id: "asc" } } },
        where: { id: plan.id },
      }),
    ).resolves.toStrictEqual(before);
  });
});
