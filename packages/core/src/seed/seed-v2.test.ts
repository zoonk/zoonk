import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, toIsoDate } from "../plans/planner/plan-calendar";
import { readMissionDocument } from "../sessions/missions/catalog";
import { seedV2PersonaCopy } from "./seed-v2";

/** Ana's Friday, Oct 16 in São Paulo. */
const FRIDAY = new Date("2026-10-16T20:52:12Z");
const TODAY = new Date("2026-10-16T00:00:00Z");
const HISTORY_DAYS = 14;

/**
 * The days Ana studied before her Friday. Her history rolls from her own seed key, which skips
 * none of her 14 days: she studied every day from Oct 2 to Oct 15.
 */
const ANA_STUDY_DATES = Array.from({ length: HISTORY_DAYS }, (_, index) =>
  toIsoDate(addDays(TODAY, index - HISTORY_DAYS)),
);

/** The days a learner studied before today, as their daily totals record them. */
async function listStudyDates(userId: string): Promise<string[]> {
  const days = await prisma.dailyProgress.findMany({
    orderBy: { date: "asc" },
    select: { date: true },
    where: { date: { lt: TODAY }, userId },
  });

  return days.map((day) => toIsoDate(day.date));
}

describe("a persona's copy", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRIDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Copy keys whose own rolls skip days Ana studied: 535d0cba skips a Monday, and ef53361d skips
  // the Wednesday and Thursday before her Friday, which would make that Friday a welcome back.
  it.each(["535d0cba", "ef53361d"])(
    "has Ana's study days and her Friday under copy key %s",
    async (copyKey) => {
      const copy = await seedV2PersonaCopy({
        copyKey,
        email: `persona-copy-${copyKey}@zoonk.test`,
        persona: "exam",
      });

      const [dates, today] = await Promise.all([
        listStudyDates(copy.userId),
        prisma.studySession.findFirstOrThrow({
          select: { freshStart: true },
          where: { localDate: TODAY, userId: copy.userId },
        }),
      ]);

      expect({ dates, freshStart: today.freshStart }).toStrictEqual({
        dates: ANA_STUDY_DATES,
        freshStart: null,
      });

      const sessions = await prisma.studySession.findMany({
        where: { localDate: { lt: TODAY }, userId: copy.userId },
      });

      const missions = sessions.map((session) => readMissionDocument(session.missions));

      expect(missions).toHaveLength(HISTORY_DAYS);
      expect(missions.every((document) => document !== null)).toBe(true);
      expect(missions.some((document) => (document?.picks.length ?? 0) > 0)).toBe(true);
    },
  );
});
