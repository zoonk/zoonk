import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayView } from "../view-models/today/get-today-view";
import { SESSION_NOW, SESSION_TODAY, sessionGoalFixture } from "./_test-utils/session-goal";
import { openStudyDay } from "./open-study-day";

async function setup() {
  const user = await userFixture();
  const { goal } = await sessionGoalFixture({ userId: user.id });

  const day = await studySessionFixture({
    goalId: goal.id,
    localDate: SESSION_TODAY,
    missions: {
      picks: [{ anchor: { blockKind: "practice" }, kind: "practice", total: 1 }],
      version: 1,
    },
    plannedMinutes: 5,
    startedAt: SESSION_NOW,
    userId: user.id,
  });

  await studySessionBlockFixture({
    completedAt: SESSION_NOW,
    estimatedMinutes: 5,
    kind: "practice",
    sessionId: day.id,
    status: "completed",
  });

  mockSession(user.id);
  return { day, goal, input: { goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" }, user };
}

describe("mission recovery belongs to the learner's open POST", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("reads ready progress without paying it, then two opens pay and mark it once without expiring tags", async () => {
    const fixture = await setup();
    const read = await countDatabaseStatements(() => getTodayView(fixture.input));
    expect(read.writes).toBe(0);

    expect(read.result).toMatchObject({
      status: "ready",
      today: { session: { fullMeal: { earned: false, ready: true } } },
    });

    const expirations = vi.mocked(revalidateTag).mock.calls.length;
    const opened = await Promise.all([openStudyDay(fixture.input), openStudyDay(fixture.input)]);
    expect(opened).toHaveLength(2);

    expect(
      opened.every((result) => result.status === "opened" && result.session.id === fixture.day.id),
    ).toBe(true);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: fixture.day.id } }),
    ).resolves.toMatchObject({
      fullMealAt: SESSION_NOW,
      missions: { picks: [{ done: 1, kind: "practice", total: 1 }] },
    });

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: fixture.user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: 50n });

    expect(revalidateTag).toHaveBeenCalledTimes(expirations);
    const replay = await countDatabaseStatements(() => openStudyDay(fixture.input));
    expect(replay.writes).toBe(0);

    expect(replay.result).toMatchObject({
      session: { fullMeal: { earned: true } },
      status: "opened",
    });
  });
});
