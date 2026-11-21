import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { seedPersonaCopy } from "../seed/seed";
import { getTodayView } from "../view-models/today/get-today-view";
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
});
