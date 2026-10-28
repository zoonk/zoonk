import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getTodayView } from "../view-models/today/get-today-view";
import { lapsedDayFixture, readLapsedDayState } from "./_test-utils/entitlement-lapse";
import { SESSION_NOW } from "./_test-utils/session-goal";
import { toDayBlockRef } from "./day-block";
import { openStudyDay, openStudySession } from "./open-study-day";

describe("an entitlement replacement is settled once", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("keeps the first 4-minute replacement through GET, repeated Open and Continue without adding the next 8 minutes", async () => {
    const day = await lapsedDayFixture();

    const extra = await libraryLessonFixture({
      estimatedMinutes: 8,
      title: "Later eight-minute lesson",
    });

    await Promise.all([
      lessonSkillFixture({ lessonId: extra.id, skillId: day.skills.at(-1)!.id }),
      prisma.planItem.updateMany({
        data: { position: { increment: 1 } },
        where: { kind: "boss", phase: 1, planId: day.plan.id },
      }),
    ]);

    await planItemFixture({
      kind: "lesson",
      lessonId: extra.id,
      phase: 1,
      planId: day.plan.id,
      position: 6,
      scheduledFor: new Date("2026-10-01"),
    });

    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: day.user.id });
      await tx.goal.update({ data: { dailyMinutes: 10 }, where: { id: day.goal.id } });
    });

    const input = { goalId: day.goal.id, shownDate: "2026-09-30", timeZone: "UTC" };
    const first = await openStudyDay(input);
    expect(first.status).toBe("opened");

    if (first.status !== "opened") {
      throw new Error("Expected the first replacement");
    }

    expect(first.session.blocks).toHaveLength(1);
    expect(first.session.blocks[0]).toMatchObject({ estimatedMinutes: 4, kind: "learn" });
    const saved = await readLapsedDayState(day.user.id);
    const read = await countDatabaseStatements(() => getTodayView(input));
    expect(read.writes).toBe(0);
    expect(read.result.status).toBe("ready");

    if (read.result.status !== "ready") {
      throw new Error("Expected the saved replacement preview");
    }

    expect
      .soft(read.result.today.session.blocks.map(toDayBlockRef))
      .toStrictEqual(first.session.blocks.map(toDayBlockRef));

    const repeated = await openStudyDay(input);
    expect(repeated.status).toBe("opened");

    if (repeated.status !== "opened") {
      throw new Error("Expected the same saved replacement");
    }

    expect.soft(repeated.session.blocks).toStrictEqual(first.session.blocks);

    const continued = await openStudySession({
      input: { timeZone: "UTC" },
      sessionId: day.sessionId,
    });

    expect(continued.status).toBe("ready");

    if (continued.status !== "ready") {
      throw new Error("Expected Continue to replay the replacement");
    }

    expect.soft(continued.session.blocks).toStrictEqual(first.session.blocks);
    await expect(readLapsedDayState(day.user.id)).resolves.toStrictEqual(saved);
  });
});
