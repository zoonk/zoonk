import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { getExamCalendar } from "./exam-calendar";

const citation = { passage: "", sourceId: "notice" };

/** A notice's edition with its exam days, all at 13:30 in Brasília. */
function examBlueprint({ days, year }: { days: string[]; year: number }) {
  return examBlueprintFixture({
    edition: {
      citations: [],
      dates: days.map((date, index) => ({
        citation,
        date,
        kind: "exam",
        label: `Day ${index + 1}`,
        startTime: "13:30",
      })),
      noticeUrl: null,
      questionCount: 120,
      sourceHash: null,
      timeZone: "America/Sao_Paulo",
      year,
    },
  });
}

const STARTED = new Date("2026-09-27T15:00:00Z");
const GOAL = { createdAt: STARTED, details: {}, targetDate: null, timezone: "America/Sao_Paulo" };

describe(getExamCalendar, () => {
  it("uses the notice's exam days for an edition still ahead", async () => {
    const blueprint = await examBlueprint({ days: ["2026-11-08", "2026-11-15"], year: 2026 });

    expect(getExamCalendar({ blueprint, goal: GOAL })).toStrictEqual({
      days: [
        { date: "2026-11-08", label: "Day 1", startTime: "13:30" },
        { date: "2026-11-15", label: "Day 2", startTime: "13:30" },
      ],
      estimated: false,
      timeZone: "America/Sao_Paulo",
    });

    const named = { ...GOAL, details: { examName: "ENEM", examYear: 2026 } };

    expect(getExamCalendar({ blueprint, goal: named })).toMatchObject({ estimated: false });
  });

  it("estimates the days of the year the learner named when the notice is another year's", async () => {
    const blueprint = await examBlueprint({ days: ["2026-11-08", "2026-11-15"], year: 2026 });
    const goal = { ...GOAL, details: { examName: "ENEM", examYear: 2028 } };

    expect(getExamCalendar({ blueprint, goal })).toStrictEqual({
      days: [
        { date: "2028-11-12", label: "Day 1", startTime: "13:30" },
        { date: "2028-11-19", label: "Day 2", startTime: "13:30" },
      ],
      estimated: true,
      timeZone: "America/Sao_Paulo",
    });

    // The plan's own date for an estimate (two weeks early) doesn't replace the exam's days.
    const planned = { ...goal, targetDate: new Date("2028-10-29T00:00:00Z") };

    expect(getExamCalendar({ blueprint, goal: planned }).days[0]?.date).toBe("2028-11-12");
  });

  it("estimates the next edition once the notice's days all passed before the goal started", async () => {
    const blueprint = await examBlueprint({ days: ["2025-07-27"], year: 2025 });

    expect(getExamCalendar({ blueprint, goal: GOAL })).toMatchObject({
      days: [{ date: "2027-07-25", label: "Day 1", startTime: "13:30" }],
      estimated: true,
    });
  });

  it("uses the goal's own date for an exam whose notice has no days", async () => {
    const dated = { ...GOAL, targetDate: new Date("2027-03-14T00:00:00Z") };

    expect(getExamCalendar({ blueprint: null, goal: dated })).toStrictEqual({
      days: [{ date: "2027-03-14", label: null, startTime: null }],
      estimated: false,
      timeZone: null,
    });

    expect(getExamCalendar({ blueprint: null, goal: GOAL }).days).toStrictEqual([]);
  });

  it("falls back to the goal's own date when the year the learner named has passed", async () => {
    const blueprint = await examBlueprint({ days: ["2026-11-08"], year: 2026 });

    const goal = {
      ...GOAL,
      details: { examYear: 2025 },
      targetDate: new Date("2027-03-14T00:00:00Z"),
    };

    expect(getExamCalendar({ blueprint, goal }).days.map((day) => day.date)).toStrictEqual([
      "2027-03-14",
    ]);
  });
});
