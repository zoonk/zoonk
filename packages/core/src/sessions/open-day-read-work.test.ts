import { prisma } from "@zoonk/db";
import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayView } from "../view-models/today/get-today-view";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { openStudyDay } from "./open-study-day";

describe("opening a day and reading it", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("reuses the selected day facts and projects access without loading unrelated usage", async () => {
    const user = await userFixture();
    const { goal, plan } = await sessionGoalFixture({ userId: user.id });
    await layOutPlanFixture(plan.id);
    mockSession(user.id);

    const input = { goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" };
    const opened = await countDatabaseStatements(() => openStudyDay(input));
    expect(opened.result.status).toBe("opened");

    const saved = await prisma.studySession.findFirstOrThrow({ where: { goalId: goal.id } });
    const read = await countDatabaseStatements(() => getTodayView(input));
    expect(read.writes).toBe(0);
    expect(read.result).toMatchObject({ status: "ready", today: { session: { id: saved.id } } });

    if (opened.result.status !== "opened" || read.result.status !== "ready") {
      throw new Error("Expected the saved opened day on both responses");
    }

    expect(read.result.today.session).toStrictEqual(opened.result.session);
    expect(opened.statements + read.statements).toBeLessThanOrEqual(205);
  });

  it("keeps the same display-limit day when a different owned goal crosses midnight", async () => {
    const user = await userFixture();
    const selected = await sessionGoalFixture({ goal: { timezone: "UTC" }, userId: user.id });

    const other = await sessionGoalFixture({
      goal: { timezone: "Pacific/Kiritimati" },
      userId: user.id,
    });

    await learningProfileFixture({
      activeGoalId: selected.goal.id,
      dailyLimitMinutes: 30,
      userId: user.id,
    });

    await prisma.dailyProgress.create({
      data: {
        date: new Date("2026-09-30T00:00:00Z"),
        dayOfWeek: 3,
        timeSpentSeconds: 1200,
        userId: user.id,
      },
    });

    mockSession(user.id);

    const input = {
      goalId: other.goal.id,
      keepEmpty: true,
      shownDate: "2026-10-01",
      timeZone: "Pacific/Kiritimati",
    };

    const opened = await openStudyDay(input);
    const read = await getTodayView(input);
    expect(opened.status).toBe("opened");
    expect(read.status).toBe("ready");

    if (opened.status !== "opened" || read.status !== "ready") {
      throw new Error("Expected the other goal's day to open and read");
    }

    expect(opened.session.dailyLimit).toStrictEqual(read.today.session.dailyLimit);
    expect(opened.session.dailyLimit).toMatchObject({ remainingMinutes: 10, usedMinutes: 20 });
  });
});
