import { describe, expect, it } from "vitest";
import { type PlanStatusItem } from "../../preparation/plan-status";
import { planAssessmentSchema, readPlanHeadline } from "../plan-assessment-contract";
import { readPlanAssessment } from "./plan-assessment";
import { type PlanSummary } from "./plan-summary";

const day = (date: string) => new Date(`${date}T00:00:00Z`);

const TODAY = day("2026-10-15");
const TARGET = day("2026-11-01");

/** A lesson a day from Oct 13, those before today done: the learner keeps pace. */
function lessons(count: number, { done = 2 } = {}): PlanStatusItem[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterId: null,
    kind: "lesson" as const,
    lessonId: `lesson-${index}`,
    lessons: null,
    scheduledFor: new Date(day("2026-10-13").getTime() + index * 86_400_000),
    skillId: "s1",
    status: index < done ? ("done" as const) : ("todo" as const),
  }));
}

function summaryOf({
  coveredShare,
  fits,
  targetDate = "2026-11-01",
}: {
  coveredShare: number;
  fits: boolean;
  targetDate?: string;
}): PlanSummary {
  return {
    basis: {
      layoutInputVersion: 3,
      layoutStudyDay: "2026-10-13",
      planId: "plan-a",
      planVersion: 5,
      timeZone: "UTC",
      userId: "learner-a",
    },
    schemaVersion: 2,
    selected: {
      bases: null,
      coverage: {
        basis: "selected",
        coreFits: fits,
        coveredShare,
        deadline: targetDate,
        fits,
        measure: "exam",
        shortLessons: [],
        skills: [],
        targetDate,
      },
      endDate: "2026-10-31",
      forecast: {
        basis: "estimated",
        dailyNeed: { basis: "estimated", minutes: 90 },
        finish: { date: "2027-02-01" },
      },
      phaseDates: { structureKey: null, trigger: false },
      requirement: { doneRaw: 10, remainingRaw: 900, totalRaw: 910 },
      sourceSkillIds: [],
      totalMinutes: 400,
    },
  };
}

const pace = {
  catchUp: 0,
  estimateHours: null,
  freeWeekOver: false,
  phaseChallengesRequired: true,
  studiesPastTarget: false,
};

/** The assessment, as the public contract serializes it. */
const assess = (overrides: Partial<Parameters<typeof readPlanAssessment>[0]> = {}) =>
  planAssessmentSchema.parse(
    readPlanAssessment({
      day: TODAY,
      goal: { kind: "exam", targetDate: TARGET },
      items: lessons(10),
      pace,
      pendingAdaptation: [],
      summary: summaryOf({ coveredShare: 1, fits: true }),
      ...overrides,
    }),
  );

describe(readPlanAssessment, () => {
  // journey:638: the schedule was cut to the date and the learner keeps it, but what it selects
  // covers 12% of the exam by the date. Pace alone read "on track".
  it("says a truncated plan the learner keeps doesn't fit, with its pace on track", () => {
    const assessment = assess({ summary: summaryOf({ coveredShare: 0.12, fits: false }) });

    expect(assessment.fit).toMatchObject({
      coverage: { coveredShare: 0.12 },
      evidence: "coverage",
      options: ["addTime", "narrowScope", "moveDate"],
      verdict: "doesNotFit",
    });

    expect(assessment.pace).toStrictEqual({ kind: "onPace" });

    expect(readPlanHeadline(assessment)).toStrictEqual({
      kind: "doesNotFit",
      options: ["addTime", "narrowScope", "moveDate"],
    });
  });

  // journey:638 also moves the goal's date straight in the database: the stored work then runs
  // past it, which is a definite "doesn't fit" whatever the stored numbers say.
  it("says a plan with work after a moved date doesn't fit, whatever its numbers say", () => {
    const assessment = assess({ goal: { kind: "exam", targetDate: day("2026-10-20") } });

    expect(assessment.fit).toMatchObject({ evidence: "workAfterDate", verdict: "doesNotFit" });
    expect(assessment.pace).toStrictEqual({ kind: "onPace" });
    expect(readPlanHeadline(assessment)).toMatchObject({ kind: "doesNotFit" });
  });

  it("reads numbers of another date as pending when the work still ends before it", () => {
    const assessment = assess({ goal: { kind: "exam", targetDate: day("2026-12-01") } });

    expect(assessment.fit).toMatchObject({ coverage: { coveredShare: 1 }, verdict: "pending" });
    expect(readPlanHeadline(assessment)).toStrictEqual({ kind: "pending" });
  });

  it("fits when the stored plan covers everything by its date and nothing is pending", () => {
    const assessment = assess();

    expect(assessment.fit).toMatchObject({ verdict: "fits" });
    expect(assessment.pending).toBeNull();
    expect(assessment.asOf).toStrictEqual({ layoutStudyDay: "2026-10-13", planVersion: 5 });
    expect(readPlanHeadline(assessment)).toStrictEqual({ kind: "pace", pace: { kind: "onPace" } });
  });

  it("never reads a plan that may not reflect its inputs as fitting or on track", () => {
    const assessment = assess({ pendingAdaptation: ["evidence", "pace"] });

    expect(assessment.fit).toMatchObject({ coverage: { coveredShare: 1 }, verdict: "pending" });
    expect(assessment.pending).toStrictEqual({ legacy: false, reasons: ["evidence", "pace"] });
    expect(readPlanHeadline(assessment)).toStrictEqual({ kind: "pending" });
  });

  it("keeps a plan that doesn't fit as such while something is pending", () => {
    const assessment = assess({
      pendingAdaptation: ["content"],
      summary: summaryOf({ coveredShare: 0.4, fits: false }),
    });

    expect(assessment.fit).toMatchObject({ verdict: "doesNotFit" });
    expect(readPlanHeadline(assessment)).toMatchObject({ kind: "doesNotFit" });
  });

  it("reads a plan without numbers that describe it as pending, never as fitting", () => {
    const assessment = assess({ summary: null });

    expect(assessment.fit).toStrictEqual({ coverage: null, verdict: "pending" });
    expect(assessment.pending).toStrictEqual({ legacy: true, reasons: [] });
    expect(assessment.asOf).toBeNull();
    expect(readPlanHeadline(assessment)).toStrictEqual({ kind: "pending" });
  });

  it("has no fit to tell for a goal without a date", () => {
    const assessment = assess({ goal: { kind: "learn", targetDate: null } });

    expect(assessment.fit).toStrictEqual({ verdict: "noDeadline" });
    expect(readPlanHeadline(assessment)).toMatchObject({ kind: "pace" });
  });

  it.each(["content", "pace"] as const)(
    "keeps an undated plan with pending %s from an on-pace headline",
    (reason) => {
      const summary = summaryOf({ coveredShare: 1, fits: true });

      const assessment = assess({
        goal: { kind: "learn", targetDate: null },
        pendingAdaptation: [reason],
        summary: { ...summary, selected: { ...summary.selected, coverage: null } },
      });

      expect(assessment.fit).toStrictEqual({ verdict: "noDeadline" });
      expect(assessment.pace).toStrictEqual({ kind: "onPace" });
      expect(assessment.pending).toStrictEqual({ legacy: false, reasons: [reason] });
      expect(readPlanHeadline(assessment)).toStrictEqual({ kind: "pending" });
    },
  );

  it("keeps an undated plan without a valid summary from an on-pace headline", () => {
    const assessment = assess({ goal: { kind: "learn", targetDate: null }, summary: null });

    expect(assessment.fit).toStrictEqual({ verdict: "noDeadline" });
    expect(assessment.pace).toStrictEqual({ kind: "onPace" });
    expect(assessment.pending).toStrictEqual({ legacy: true, reasons: [] });
    expect(readPlanHeadline(assessment)).toStrictEqual({ kind: "pending" });
  });

  it("says a finished plan is finished before anything else", () => {
    const assessment = assess({
      items: lessons(10, { done: 10 }),
      pendingAdaptation: ["content"],
      summary: summaryOf({ coveredShare: 0.12, fits: false }),
    });

    expect(assessment.lifecycle).toStrictEqual({ kind: "finished" });

    expect(readPlanHeadline(assessment)).toStrictEqual({
      kind: "lifecycle",
      lifecycle: { kind: "finished" },
    });
  });

  it("tells the pace apart from the fit: behind, with the small fix", () => {
    const assessment = assess({ items: lessons(10, { done: 0 }) });

    expect(assessment.pace).toStrictEqual({
      catchUp: { days: 1, extraMinutesPerDay: 10 },
      kind: "behind",
      lessons: null,
    });

    expect(assessment.fit).toMatchObject({ verdict: "fits" });
  });
});
