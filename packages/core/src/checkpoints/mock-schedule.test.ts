import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { seedPersonaCopy } from "../seed/seed";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { changeMockSchedule, getMockSchedule, undoMockSchedule } from "./mock-schedule";

describe("scheduled mock changes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T20:52:12Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves one funded mock twice, skips it, and restores the second date", async () => {
    const copyKey = randomUUID().slice(0, 8);

    const copy = await seedPersonaCopy({
      copyKey,
      email: `schedule-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(copy.userId);

    const original = await prisma.planItem.findFirstOrThrow({
      where: { kind: "mock", plan: { goalId: copy.goalId }, scheduledFor: new Date("2026-11-08") },
    });

    const timeZone = "America/Sao_Paulo";
    const get = (planItemId: string) => getMockSchedule({ planItemId, timeZone });

    const change = (planItemId: string, date: string | null) =>
      changeMockSchedule({ input: { date, timeZone }, planItemId });

    const others = async (except: string) => {
      const mocks = await prisma.planItem.findMany({
        orderBy: { scheduledFor: "asc" },
        where: { id: { not: except }, kind: "mock", planId: original.planId, status: "todo" },
      });

      return mocks.map((item) => item.scheduledFor?.toISOString());
    };

    const fundingOn = async (date: string) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { id: original.planId } });
      return parsePlanSettings(plan.settings).mockFunding.find((entry) => entry.date === date);
    };

    const paper = await fundingOn("2026-11-08");
    expect(paper?.day).toBeDefined();
    const identity = { day: paper?.day, fullLength: paper?.fullLength, minutes: paper?.minutes };
    const before = await others(original.id);

    const target = await prisma.goal.findUniqueOrThrow({
      select: { targetDate: true },
      where: { id: copy.goalId },
    });

    const goal = await prisma.goal.update({
      data: { targetDate: null },
      select: { id: true },
      where: { id: copy.goalId },
    });

    await expect(get(original.id)).resolves.toMatchObject({
      dates: expect.arrayContaining(["2026-11-09"]),
      status: "ready",
    });

    await prisma.goal.update({ data: { targetDate: target.targetDate }, where: { id: goal.id } });
    const options = await get(original.id);

    expect(options).toMatchObject({
      dates: expect.arrayContaining(["2026-11-09", "2026-11-10"]),
      status: "ready",
    });

    await expect(change(original.id, "2026-11-08")).resolves.toStrictEqual({
      status: "notMovable",
    });

    const first = await change(original.id, "2026-11-09");
    expect(first.status).toBe("changed");

    if (first.status !== "changed") {
      return;
    }

    await expect(fundingOn("2026-11-09")).resolves.toMatchObject(identity);
    await expect(others(first.planItemId)).resolves.toStrictEqual(before);
    const second = await change(first.planItemId, "2026-11-10");
    expect(second.status).toBe("changed");

    if (second.status !== "changed") {
      return;
    }

    await expect(others(second.planItemId)).resolves.toStrictEqual(before);
    await expect(fundingOn("2026-11-10")).resolves.toMatchObject(identity);
    const skipped = await change(second.planItemId, null);
    expect(skipped.status).toBe("changed");

    if (skipped.status !== "changed") {
      return;
    }

    await expect(others(second.planItemId)).resolves.toStrictEqual(before);

    await expect(
      prisma.planItem.count({
        where: {
          kind: "mock",
          planId: original.planId,
          scheduledFor: new Date("2026-11-10"),
          status: "todo",
        },
      }),
    ).resolves.toBe(0);

    await expect(
      undoMockSchedule({ changeId: skipped.changeId, planItemId: original.id, timeZone }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      undoMockSchedule({ changeId: skipped.changeId, planItemId: second.planItemId, timeZone }),
    ).resolves.toStrictEqual({ status: "undone" });

    await expect(
      prisma.planItem.findFirst({
        where: {
          kind: "mock",
          planId: original.planId,
          scheduledFor: new Date("2026-11-10"),
          status: "todo",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("removes an unstarted mock from today's saved session atomically, restores it, and refuses a started block", async () => {
    const copyKey = randomUUID().slice(0, 8);

    const copy = await seedPersonaCopy({
      copyKey,
      email: `schedule-day-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(copy.userId);
    vi.setSystemTime(new Date("2026-11-08T14:00:00Z"));
    const { goalId } = copy;
    const timeZone = "America/Sao_Paulo";
    await getTodayStudySession({ goalId, timeZone });

    const item = await prisma.planItem.findFirstOrThrow({
      where: {
        kind: "mock",
        plan: { goalId },
        scheduledFor: new Date("2026-11-08"),
        status: "todo",
      },
    });

    const block = await prisma.studySessionBlock.findFirstOrThrow({
      where: { payload: { equals: item.id, path: ["planItemId"] }, session: { goalId } },
    });

    vi.setSystemTime(new Date("2026-11-09T14:00:00Z"));

    await expect(getMockSchedule({ planItemId: item.id, timeZone })).resolves.toMatchObject({
      dates: expect.arrayContaining(["2026-11-10"]),
      status: "ready",
    });

    vi.setSystemTime(new Date("2026-11-08T14:00:00Z"));

    const result = await changeMockSchedule({
      input: { date: null, timeZone },
      planItemId: item.id,
    });

    expect(result.status).toBe("changed");

    if (result.status !== "changed") {
      return;
    }

    await expect(
      prisma.studySessionBlock.findUnique({ where: { id: block.id } }),
    ).resolves.toBeNull();

    await expect(
      undoMockSchedule({ changeId: result.changeId, planItemId: item.id, timeZone }),
    ).resolves.toStrictEqual({ status: "undone" });

    await expect(
      prisma.studySessionBlock.findUnique({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    await prisma.studySessionBlock.update({
      data: { startedAt: new Date(), status: "active" },
      where: { id: block.id },
    });

    await expect(
      changeMockSchedule({ input: { date: null, timeZone }, planItemId: item.id }),
    ).resolves.toStrictEqual({ status: "notMovable" });
  });
});
