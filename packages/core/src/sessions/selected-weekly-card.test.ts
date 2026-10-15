import { prisma } from "@zoonk/db";
import { fundedMockRelocationDayFixture } from "@zoonk/testing/fixtures/funded-mock-days";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayView } from "../view-models/today/get-today-view";
import { openStudyDay } from "./open-study-day";

const LOCAL_DATES = [
  "2026-10-12",
  "2026-10-13",
  "2026-10-14",
  "2026-10-15",
  "2026-10-16",
  "2026-10-17",
  "2026-10-18",
];

describe("the selected weekly card before its saved row exists", () => {
  afterEach(() => vi.useRealTimers());

  it.each(LOCAL_DATES)(
    "shows the actual selected mock on %s, then Open persists its link",
    async (date) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(`${date}T12:00:00Z`));
      const user = await userFixture();

      const fixture = await fundedMockRelocationDayFixture({
        localDate: new Date(date),
        userId: user.id,
      });

      mockSession(user.id);

      const saved = () =>
        prisma.plan.findUniqueOrThrow({
          include: { items: { orderBy: { position: "asc" } } },
          where: { id: fixture.plan.id },
        });

      const before = await saved();

      const read = await countDatabaseStatements(() =>
        getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" }),
      );

      expect(read.writes).toBe(0);
      expect(read.result.status).toBe("ready");

      if (read.result.status !== "ready") {
        throw new Error("Expected the actual selected mock preview");
      }

      const shown = read.result.today.weeklyChallenge;
      expect(shown).toMatchObject({ kind: "mock", planItemId: null });

      if (!shown?.date) {
        throw new Error("Expected the real selected date");
      }

      expect(shown.date.getTime()).toBeGreaterThan(fixture.from.getTime());
      await expect(saved()).resolves.toStrictEqual(before);

      const opened = await openStudyDay({
        goalId: fixture.goal.id,
        keepEmpty: true,
        shownDate: date,
        timeZone: "UTC",
      });

      expect(opened.status).toBe("opened");
      const after = await getTodayView({ goalId: fixture.goal.id, timeZone: "UTC" });
      expect(after.status).toBe("ready");

      if (after.status !== "ready") {
        throw new Error("Expected the saved selected mock");
      }

      expect(after.today.weeklyChallenge).toStrictEqual({
        ...shown,
        planItemId: expect.any(String),
      });

      expect(after.today.weeklyChallenge?.planItemId).not.toBe(fixture.mock.id);

      await expect(
        prisma.planItem.findUnique({
          where: { id: after.today.weeklyChallenge?.planItemId ?? "" },
        }),
      ).resolves.toMatchObject({ kind: "mock", scheduledFor: shown.date });
    },
  );
});
