import { prisma } from "@zoonk/db";
import { mandatoryNoticeDayFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayView } from "../view-models/today/get-today-view";
import { acknowledgeTodayPlanChange } from "./acknowledge-today-plan-change";

/** The browser seed must work on different real calendar labels without a stored proposal. */
describe("date-parameterized mandatory Today seed", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it.each(["2026-10-14", "2026-10-15", "2027-01-02"])(
    "computes and acknowledges the actual mandatory move on %s",
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

      const notice = read.result.today.planChange;

      expect(notice).toMatchObject({
        behind: { coveredBefore: 1, measure: "goal" },
        canUndo: false,
        id: null,
        kind: "missedDays",
        source: "system",
        status: "applied",
      });

      expect(read.result.today.session).toMatchObject({
        blocks: [],
        lessonsComing: false,
        minutes: { dailyGoal: 0 },
      });

      await expect(prisma.planChange.count({ where: { planId: fixture.plan.id } })).resolves.toBe(
        0,
      );

      if (!read.result.today.noticeBasis) {
        throw new Error("Expected the notice's plan");
      }

      const acknowledged = await acknowledgeTodayPlanChange({
        basis: read.result.today.noticeBasis,
        goalId: fixture.goal.id,
        kind: "computed",
        shownDate: date,
        timeZone: "UTC",
      });

      expect(acknowledged.status).toBe("acknowledged");
      await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(0);
    },
  );
});
