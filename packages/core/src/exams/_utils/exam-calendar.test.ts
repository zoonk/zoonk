import { randomUUID } from "node:crypto";
import { type ExamBlueprint } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { getExamCalendar, getGoalDateKind } from "./exam-calendar";

const citation = { passage: "", sourceId: "notice" };

function examBlueprint({
  days,
  ownerId = null,
  year,
}: {
  days: string[];
  ownerId?: string | null;
  year: number;
}): ExamBlueprint {
  const generatedAt = new Date("2026-09-01T00:00:00Z");

  return {
    board: null,
    country: "BR",
    createdAt: generatedAt,
    edition: {
      check: null,
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
    examDate: null,
    generatedAt,
    id: randomUUID(),
    identityKey: `test-exam-${randomUUID()}`,
    language: "pt",
    model: "test",
    name: "Test Exam",
    nextCheckAt: null,
    ownerId,
    promptVersion: "test",
    registrationEndsAt: null,
    role: null,
    runId: "test",
    sourceId: null,
    structure: {},
    topicFrequency: null,
    updatedAt: generatedAt,
    validUntil: null,
    visibility: ownerId ? "private" : "public",
  };
}

const STARTED = new Date("2026-09-27T15:00:00Z");
const GOAL = { createdAt: STARTED, details: {}, targetDate: null, timezone: "America/Sao_Paulo" };

describe(getExamCalendar, () => {
  it("uses the notice's exam days for an edition still ahead", () => {
    const blueprint = examBlueprint({ days: ["2026-11-08", "2026-11-15"], year: 2026 });

    expect(getExamCalendar({ blueprint, goal: GOAL })).toStrictEqual({
      days: [
        { date: "2026-11-08", label: "Day 1", startTime: "13:30" },
        { date: "2026-11-15", label: "Day 2", startTime: "13:30" },
      ],
      estimated: false,
      namedMonth: false,
      timeZone: "America/Sao_Paulo",
    });

    const named = { ...GOAL, details: { examName: "ENEM", examYear: 2026 } };

    expect(getExamCalendar({ blueprint, goal: named })).toMatchObject({ estimated: false });
  });

  it("estimates the days of the year the learner named when the notice is another year's", () => {
    const blueprint = examBlueprint({ days: ["2026-11-08", "2026-11-15"], year: 2026 });
    const goal = { ...GOAL, details: { examName: "ENEM", examYear: 2028 } };

    expect(getExamCalendar({ blueprint, goal })).toStrictEqual({
      days: [
        { date: "2028-11-12", label: "Day 1", startTime: "13:30" },
        { date: "2028-11-19", label: "Day 2", startTime: "13:30" },
      ],
      estimated: true,
      namedMonth: false,
      timeZone: "America/Sao_Paulo",
    });

    const planned = { ...goal, targetDate: new Date("2028-11-12T00:00:00Z") };

    expect(getExamCalendar({ blueprint, goal: planned })).toMatchObject({
      days: [{ date: "2028-11-12" }, { date: "2028-11-19" }],
      estimated: true,
    });
  });

  it("moves the estimated days to the learner's date near them, keeping every day and start time", () => {
    const blueprint = examBlueprint({ days: ["2026-11-08", "2026-11-15"], year: 2026 });
    const goal = { ...GOAL, details: { examName: "ENEM", examYear: 2028 } };
    const earlier = { ...goal, targetDate: new Date("2028-11-05T00:00:00Z") };

    expect(getExamCalendar({ blueprint, goal: earlier })).toStrictEqual({
      days: [
        { date: "2028-11-05", label: "Day 1", startTime: "13:30" },
        { date: "2028-11-12", label: "Day 2", startTime: "13:30" },
      ],
      estimated: true,
      namedMonth: false,
      timeZone: "America/Sao_Paulo",
    });

    const far = { ...goal, targetDate: new Date("2028-06-04T00:00:00Z") };

    expect(getExamCalendar({ blueprint, goal: far })).toMatchObject({
      days: [{ date: "2028-06-04", label: null, startTime: null }],
      estimated: false,
    });
  });

  it("shows the date the plan counts down to when it isn't one of the notice's days", () => {
    const blueprint = examBlueprint({ days: ["2026-11-08", "2026-11-15"], year: 2026 });
    const goal = { ...GOAL, targetDate: new Date("2027-03-14T00:00:00Z") };

    expect(getExamCalendar({ blueprint, goal })).toStrictEqual({
      days: [{ date: "2027-03-14", label: null, startTime: null }],
      estimated: false,
      namedMonth: false,
      timeZone: null,
    });
  });

  it("marks the start of the month the learner named as her month when the notice gives another month", () => {
    const blueprint = examBlueprint({ days: ["2027-01-10"], year: 2026 });

    const goal = {
      ...GOAL,
      details: { examMonth: 3, examYear: 2027 },
      targetDate: new Date("2027-03-01T00:00:00Z"),
    };

    expect(getExamCalendar({ blueprint, goal })).toStrictEqual({
      days: [{ date: "2027-03-01", label: null, startTime: null }],
      estimated: true,
      namedMonth: true,
      timeZone: null,
    });
  });

  it("estimates the next edition once the notice's days all passed before the goal started", () => {
    const blueprint = examBlueprint({ days: ["2025-07-27"], year: 2025 });

    expect(getExamCalendar({ blueprint, goal: GOAL })).toMatchObject({
      days: [{ date: "2027-07-25", label: "Day 1", startTime: "13:30" }],
      estimated: true,
    });
  });

  it("never estimates a class test's day from the learner's old material: its own date counts", () => {
    const material = examBlueprint({ days: ["2025-10-09"], ownerId: randomUUID(), year: 2025 });

    const dated = { ...GOAL, targetDate: new Date("2026-10-09T00:00:00Z") };

    expect(getExamCalendar({ blueprint: material, goal: dated })).toStrictEqual({
      days: [{ date: "2026-10-09", label: null, startTime: null }],
      estimated: false,
      namedMonth: false,
      timeZone: null,
    });

    expect(getExamCalendar({ blueprint: material, goal: GOAL })).toMatchObject({
      days: [],
      estimated: false,
    });
  });

  it("uses the goal's own date for an exam whose notice has no days", () => {
    const dated = { ...GOAL, targetDate: new Date("2027-03-14T00:00:00Z") };

    expect(getExamCalendar({ blueprint: null, goal: dated })).toStrictEqual({
      days: [{ date: "2027-03-14", label: null, startTime: null }],
      estimated: false,
      namedMonth: false,
      timeZone: null,
    });

    expect(getExamCalendar({ blueprint: null, goal: GOAL }).days).toStrictEqual([]);
  });

  it("falls back to the goal's own date when the year the learner named has passed", () => {
    const blueprint = examBlueprint({ days: ["2026-11-08"], year: 2026 });

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

function goalOn(date: string, details: object = {}) {
  return { ...GOAL, details, targetDate: new Date(`${date}T00:00:00Z`) };
}

describe(getGoalDateKind, () => {
  it("tells an estimated day, the month the learner named and a day of their own apart", () => {
    const notice = examBlueprint({ days: ["2026-11-08", "2026-11-15"], year: 2026 });
    const january = examBlueprint({ days: ["2027-01-10"], year: 2026 });

    expect(
      getGoalDateKind({ blueprint: notice, goal: goalOn("2028-11-12", { examYear: 2028 }) }),
    ).toStrictEqual({ estimated: true, namedMonth: false });

    expect(
      getGoalDateKind({
        blueprint: january,
        goal: goalOn("2027-03-01", { examMonth: 3, examYear: 2027 }),
      }),
    ).toStrictEqual({ estimated: true, namedMonth: true });

    expect(getGoalDateKind({ blueprint: notice, goal: goalOn("2026-11-08") })).toStrictEqual({
      estimated: false,
      namedMonth: false,
    });

    expect(getGoalDateKind({ blueprint: notice, goal: goalOn("2026-12-20") })).toStrictEqual({
      estimated: false,
      namedMonth: false,
    });
  });
});
