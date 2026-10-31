import { prisma } from "@zoonk/db";
import { mandatoryNoticeDayFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { openStudyDay } from "../sessions/open-study-day";
import { getTodayView } from "../view-models/today/get-today-view";
import { acknowledgeTodayPlanChange } from "./acknowledge-today-plan-change";

describe("date-parameterized mandatory Today seed", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it.each(["2026-10-14", "2026-10-15", "2027-01-02"])(
    "settles and acknowledges the actual mandatory move on Start on %s",
    async (date) => {
      const user = await userFixture();

      const fixture = await mandatoryNoticeDayFixture({
        atRisk: true,
        localDate: new Date(date),
        userId: user.id,
      });

      mockSession(user.id);
      vi.setSystemTime(new Date(`${date}T12:00:00Z`));

      const read = await countDatabaseStatements(() =>
        getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
      );

      expect(read.writes).toBe(0);
      expect(read.result.status).toBe("ready");

      if (read.result.status !== "ready") {
        throw new Error("Expected the seeded mandatory day");
      }

      expect(read.result.today.planChange).toBeNull();
      expect(read.result.today.earlierWork).toStrictEqual([]);

      await expect(prisma.planChange.count({ where: { planId: fixture.plan.id } })).resolves.toBe(
        0,
      );

      const opened = await openStudyDay({
        goalId: fixture.goal.id,
        shownDate: date,
        timeZone: "UTC",
      });

      expect(opened.status).toBe("opened");
      const after = await getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });

      if (after.status !== "ready" || !after.today.planChange?.id) {
        throw new Error("Expected the stored mandatory move after Start");
      }

      expect(after.today.planChange).toMatchObject({
        behind: { coveredBefore: 1, measure: "goal" },
        canUndo: false,
        kind: "missedDays",
        source: "system",
        status: "applied",
      });

      await expect(
        acknowledgeTodayPlanChange({ changeId: after.today.planChange.id, kind: "stored" }),
      ).resolves.toMatchObject({ status: "acknowledged" });

      await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(1);
    },
  );
});
