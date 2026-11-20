import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { loadSessionBuildInput } from "./_utils/load-build-inputs";
import { buildSessionBlocks } from "./session-builder";

describe("a mock day rebuilt after the learner finished the mock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("adds nothing next to the finished mock it keeps", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: {
        dailyMinutes: 120,
        kind: "exam",
        targetDate: new Date(SESSION_TODAY.getTime() + 30 * DAY_MS),
      },
      userId: user.id,
    });

    const mock = await checkpointItemFixture({ kind: "mock", planId: plan.id, position: 30 });
    await prisma.planItem.update({ data: { status: "done" }, where: { id: mock.id } });

    const input = await loadSessionBuildInput({
      goal,
      keepsBlocks: true,
      keepsMock: true,
      localDate: SESSION_TODAY,
      now: SESSION_NOW,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(input.mockReplacesDay).toBe(true);
    expect(buildSessionBlocks(input).blocks).toStrictEqual([]);
  });
});
