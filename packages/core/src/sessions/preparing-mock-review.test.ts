import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { seedPersonaCopy } from "../seed/seed";
import { getTodayView } from "../view-models/today/get-today-view";
import { addExtraStudyBlock } from "./add-extra-study-block";
import { toDayBlockRef } from "./day-block";
import { openStudyDay } from "./open-study-day";

describe("Today on a preparing mock day", () => {
  afterEach(() => vi.useRealTimers());

  it("opens a regular review from Today when Ana's only scheduled step is a preparing mock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
    const localDate = new Date("2026-11-20");
    const copyKey = randomUUID();

    const { goalId, userId } = await seedPersonaCopy({
      copyKey,
      email: `preparing-mock-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(userId);

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    });

    const mock = await prisma.planItem.findFirstOrThrow({
      orderBy: { scheduledFor: "asc" },
      where: { kind: "mock", plan: { goalId }, scheduledFor: { gt: localDate } },
    });

    await prisma.planItem.update({ data: { scheduledFor: localDate }, where: { id: mock.id } });
    const today = { goalId, localDate };
    await prisma.studySession.deleteMany({ where: today });
    const view = await getTodayView({ goalId });

    if (view.status !== "ready") {
      throw new Error(view.status);
    }

    const day = view.today.session;

    expect(day.blocks).toContainEqual(
      expect.objectContaining({ kind: "checkpoint", preparing: true }),
    );

    expect(day).toMatchObject({ state: "underway" });
    const review = day.blocks.find((block) => block.position === day.nextPosition);
    expect(review).toMatchObject({ kind: "review", status: "pending" });
    expect(review?.questions).toBeGreaterThan(0);
    await expect(prisma.studySession.count({ where: today })).resolves.toBe(0);

    const opened = await openStudyDay({
      goalId,
      shownDate: "2026-11-20",
      target: { kind: "next", shown: toDayBlockRef(review!) },
    });

    expect(opened).toMatchObject({
      opening: { blockId: expect.any(String), kind: "session" },
      status: "opened",
      target: { kind: "review" },
      targetStatus: "next",
    });
  });

  it("offers Ana's next lessons once only her preparing mock is left", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
    const localDate = new Date("2026-11-20");
    const copyKey = randomUUID();

    const { goalId, userId } = await seedPersonaCopy({
      copyKey,
      email: `preparing-mock-up-next-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(userId);

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    });

    const mock = await prisma.planItem.findFirstOrThrow({
      orderBy: { scheduledFor: "asc" },
      where: { kind: "mock", plan: { goalId }, scheduledFor: { gt: localDate } },
    });

    await prisma.planItem.update({ data: { scheduledFor: localDate }, where: { id: mock.id } });
    await prisma.studySession.deleteMany({ where: { goalId, localDate } });
    const before = await getTodayView({ goalId });

    if (before.status !== "ready") {
      throw new Error(before.status);
    }

    expect(before.today.session.extraTime.lessons).toHaveLength(3);

    const review = before.today.session.blocks.find(
      (block) => block.position === before.today.session.nextPosition,
    );

    const opened = await openStudyDay({
      goalId,
      shownDate: "2026-11-20",
      target: { kind: "next", shown: toDayBlockRef(review!) },
    });

    if (opened.status !== "opened" || opened.opening?.kind !== "session") {
      throw new Error(opened.status);
    }

    const { sessionId } = opened.opening;

    await prisma.studySessionBlock.updateMany({
      data: { completedAt: new Date(), status: "completed" },
      where: { kind: "review", sessionId },
    });

    const after = await getTodayView({ goalId });

    if (after.status !== "ready") {
      throw new Error(after.status);
    }

    const day = after.today.session;

    expect(day).toMatchObject({ nextPosition: null, state: "waiting" });

    expect(day.blocks).toContainEqual(
      expect.objectContaining({ kind: "checkpoint", preparing: true, status: "pending" }),
    );

    expect(day.extraTime.available).toBe(true);
    expect(day.extraTime.lessons).toStrictEqual(before.today.session.extraTime.lessons);

    const added = await addExtraStudyBlock({ input: {}, sessionId });
    expect(added).toMatchObject({ block: { kind: "learn" }, status: "ready" });

    await expect(
      prisma.studySessionBlock.count({ where: { kind: "learn", sessionId } }),
    ).resolves.toBe(1);

    const next = await getTodayView({ goalId });

    if (next.status !== "ready" || added.status !== "ready") {
      throw new Error(next.status);
    }

    expect(next.today.session).toMatchObject({
      nextPosition: added.block.position,
      state: "underway",
    });
  });
});
