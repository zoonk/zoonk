import { prisma } from "@zoonk/db";
import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayView } from "../view-models/today/get-today-view";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { getStudySession } from "./get-study-session";
import { openStudyDay } from "./open-study-day";

/** Each block's lesson and where it plays, in order. */
function screens(day: { blocks: { lessonId: string | null; screen: string }[] }) {
  return day.blocks.map((block) => [block.lessonId, block.screen]);
}

describe("opening a day and reading it", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("says where each lesson plays the same way on Today, the opened day and the session's read", async () => {
    const user = await userFixture();
    const { goal, lessons, plan } = await sessionGoalFixture({ userId: user.id });
    const [written] = lessons;

    if (!written) {
      throw new Error("Expected a lesson");
    }

    await Promise.all([
      layOutPlanFixture(plan.id),
      prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: written.id } }),
    ]);

    mockSession(user.id);

    const input = { goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" };
    const opened = await openStudyDay(input);
    const today = await getTodayView(input);

    if (opened.status !== "opened" || today.status !== "ready") {
      throw new Error("Expected the opened day on both responses");
    }

    const read = await getStudySession({ input: { timeZone: "UTC" }, sessionId: opened.sessionId });

    if (read.status !== "ready") {
      throw new Error(`Expected the session, got ${read.status}`);
    }

    expect(screens(opened.session)).toContainEqual([written.id, "lesson"]);
    expect(screens(opened.session)).toContainEqual([expect.any(String), "session"]);
    expect(screens(read.session)).toStrictEqual(screens(opened.session));
    expect(screens(today.today.session)).toStrictEqual(screens(opened.session));
  });

  it("shows the opened day's session on Today without writing", async () => {
    const user = await userFixture();
    const { goal, plan } = await sessionGoalFixture({ userId: user.id });
    await layOutPlanFixture(plan.id);
    mockSession(user.id);

    const input = { goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" };
    const opened = await openStudyDay(input);
    expect(opened.status).toBe("opened");

    const saved = await prisma.studySession.findFirstOrThrow({ where: { goalId: goal.id } });
    const read = await countDatabaseStatements(() => getTodayView(input));
    expect(read.writes).toBe(0);
    expect(read.result).toMatchObject({ status: "ready", today: { session: { id: saved.id } } });

    if (opened.status !== "opened" || read.result.status !== "ready") {
      throw new Error("Expected the saved opened day on both responses");
    }

    expect(read.result.today.session).toStrictEqual(opened.session);
  });
});
