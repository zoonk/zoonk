import { describe, expect, it } from "vitest";
import { chooseBases } from "./base-choices";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { type FixedDays, estimateDailyNeed } from "./daily-need";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { DEFAULT_LESSON_MINUTES, type PlannerLesson } from "./plan-units";
import { type DayShape, type FixedEvent } from "./schedule-units";
import { summarizeSelectedPlan } from "./selected-plan-summary";

/** A Monday. */
const TODAY = fromIsoDate("2026-09-28");

function skill(skillId: string, attrs: Partial<PlanGraphSkill> = {}): PlanGraphSkill {
  return {
    area: null,
    lessons: 2,
    name: `Skill ${skillId}`,
    phase: 0,
    skillId,
    weight: null,
    ...attrs,
  };
}

function lesson(lessonId: string, skillIds: string[], minutes = 3): PlannerLesson {
  return { chapterId: "chapter", lessonId, minutes, skillIds, title: `Lesson ${lessonId}` };
}

function existing(attrs: Partial<ExistingPlanItem> & Pick<ExistingPlanItem, "id">) {
  return {
    chapterId: "chapter",
    completedAt: null,
    kind: "lesson" as const,
    lessonId: null,
    phase: 0,
    position: 0,
    scheduledFor: null,
    skillId: null,
    status: "todo" as const,
    titleSnapshot: "Existing",
    ...attrs,
  };
}

function learnInput(attrs: Partial<BuildPlanInput> = {}): BuildPlanInput {
  return {
    goal: { dailyMinutes: 30, kind: "learn", targetDate: fromIsoDate("2026-10-26") },
    graph: { phases: [{ milestone: null, name: "Basics" }], skills: [skill("s1"), skill("s2")] },
    items: [],
    lessons: [
      lesson("l1", ["s1"]),
      lesson("l2", ["s1"]),
      lesson("l3", ["s2"]),
      lesson("l4", ["s2"]),
    ],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2026-09-28" }),
    today: TODAY,
    ...attrs,
  };
}

function summarize(input: BuildPlanInput) {
  return summarizeSelectedPlan({ built: buildPlan(input), examSubjects: null, input });
}

function coverageOf(input: BuildPlanInput) {
  const coverage = summarize(input).coverage;

  if (!coverage) {
    throw new Error("Expected a dated plan's coverage");
  }

  return coverage;
}

function event(kind: FixedEvent["kind"], minutes: number, extra: Partial<FixedEvent> = {}) {
  return {
    key: `${kind}:${minutes}`,
    kind,
    minutes,
    replacesDay: kind === "mock",
    title: "",
    ...extra,
  };
}

function day(events: FixedEvent[], share: number): { shape: DayShape } {
  return { shape: { events, minutes: 0, open: true, phase: null, share } };
}

describe(estimateDailyNeed, () => {
  it("charges a leading checkpoint its day's time before lessons", () => {
    const fixed: FixedDays = {
      days: [day([event("boss", 15, { leads: true })], 0.5)],
      minutesAt: (minutes) => [minutes],
      mocks: [],
    };

    // (n - 15) * 0.5 >= 2
    expect(estimateDailyNeed({ fixed, remaining: 2 })).toStrictEqual({
      basis: "estimated",
      minutes: 19,
    });
  });

  it("charges a checkpoint beside the deadline's last lessons none of their time", () => {
    const fixed: FixedDays = {
      days: [day([event("boss", 15, { beside: true })], 1)],
      minutesAt: (minutes) => [minutes],
      mocks: [],
    };

    expect(estimateDailyNeed({ fixed, remaining: 10 })).toStrictEqual({
      basis: "estimated",
      minutes: 10,
    });
  });

  it("asks the days before a mock only what past days and its own day don't give", () => {
    // The mock's 10-minute day gives it nothing past its leading 15-minute boss, and 154 of its
    // 165 minutes were set aside before today: the day before still gives 11.
    const fixed: FixedDays = {
      days: [day([], 1), day([event("boss", 15, { leads: true }), event("mock", 165)], 1)],
      minutesAt: (minutes) => [minutes, 10],
      mocks: [{ at: 1, clock: 165, past: 154 }],
    };

    // n - 11 >= 5
    expect(estimateDailyNeed({ fixed, remaining: 5 })).toStrictEqual({
      basis: "estimated",
      minutes: 16,
    });
  });

  it("never asks less time for more work", () => {
    const fixed: FixedDays = {
      days: [
        day([], 0.6),
        day([event("checkpoint", 10)], 0.6),
        day([event("boss", 15, { leads: true })], 0.5),
        day([event("boss", 20, { beside: true })], 0.5),
        day([event("mock", 120)], 0.6),
      ],
      minutesAt: (minutes) => [minutes, Math.round(minutes * 0.5), minutes, minutes, 40],
      mocks: [{ at: 4, clock: 120, past: 30 }],
    };

    const needs = Array.from({ length: 300 }, (_, at) => {
      const need = estimateDailyNeed({ fixed, remaining: at + 1 });
      return need.minutes ?? Number.POSITIVE_INFINITY;
    });

    expect(needs.every((minutes, at) => at === 0 || minutes >= (needs[at - 1] ?? 0))).toBe(true);
  });

  it("names why there's no number", () => {
    const open: FixedDays = { days: [day([], 1)], minutesAt: (minutes) => [minutes], mocks: [] };

    const closed: FixedDays = {
      days: [{ shape: { ...day([], 1).shape, open: false } }],
      minutesAt: (minutes) => [minutes],
      mocks: [],
    };

    expect(estimateDailyNeed({ fixed: open, remaining: 0 })).toMatchObject({
      minutes: null,
      reason: "nothingLeft",
    });

    expect(estimateDailyNeed({ fixed: closed, remaining: 5 })).toMatchObject({
      minutes: null,
      reason: "noStudyDays",
    });

    expect(estimateDailyNeed({ fixed: open, remaining: 2000 })).toMatchObject({
      minutes: null,
      reason: "exceedsDay",
    });
  });
});

/** An exam whose topic builds on a 26-lesson base the Library hasn't written yet. */
function baseExamInput(choice: "deep" | null): BuildPlanInput {
  return {
    goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-12-21") },
    graph: {
      phases: [{ milestone: null, name: "Everything" }],
      skills: [
        { ...skill("base", { lessons: 26 }), area: "Bio", topics: ["base"] },
        { ...skill("top", { lessons: 3 }), area: "Bio", topics: ["top"] },
      ],
    },
    items: [],
    lessons: [],
    mockMinutes: 5,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([["top", ["base"]]]),
    readiness: new Map(),
    settings: parsePlanSettings({
      baseChoices: choice ? [{ choice, skillId: "base" }] : [],
      startDate: "2026-09-28",
    }),
    today: TODAY,
    topicLevels: [
      { level: "low", subject: "Bio", topic: "base" },
      { level: "high", subject: "Bio", topic: "top" },
    ],
  };
}

/** The base's required raw minutes when the learner studies it as `choice` says. */
function requiredOf(choice: "deep" | null) {
  const { input } = chooseBases(baseExamInput(choice));

  const coverage = summarizeSelectedPlan({
    built: buildPlan(input),
    examSubjects: null,
    input,
  }).coverage;

  return coverage?.skills.find((entry) => entry.skillId === "base")?.requiredRaw;
}

describe(summarizeSelectedPlan, () => {
  it("reads a plan without a date's end and every skill it read, with nothing to cover by", () => {
    const input = learnInput({ goal: { dailyMinutes: 3, kind: "learn", targetDate: null } });
    const built = buildPlan(input);
    const summary = summarizeSelectedPlan({ built, examSubjects: null, input });

    // The last lesson's day, or its phase's checkpoint after it.
    const last = built.items
      .filter((item) => item.kind === "lesson" || item.kind === "boss")
      .map((item) => toIsoDate(built.teachingEnds.get(item.key) ?? item.scheduledFor ?? TODAY))
      .toSorted()
      .at(-1);

    expect(summary.coverage).toBeNull();

    expect(summary.forecast.dailyNeed).toStrictEqual({
      basis: "estimated",
      minutes: null,
      reason: "noDeadline",
    });

    expect(built.items.at(-1)?.kind).toBe("boss");
    expect(summary.endDate).toBe(last);
    expect(summary.requirement).toStrictEqual({ doneRaw: 0, remainingRaw: 12, totalRaw: 12 });
    expect(summary.sourceSkillIds).toStrictEqual(["s1", "s2"]);
  });

  it("says the whole requirement fits when every lesson is laid before the date", () => {
    const summary = summarize(learnInput());

    expect(summary.coverage).toMatchObject({
      basis: "selected",
      coreFits: true,
      coveredShare: 1,
      deadline: "2026-10-26",
      fits: true,
      measure: "goal",
    });

    expect(summary.forecast.dailyNeed.minutes).toBeGreaterThan(0);
  });

  it("covers none of a skill the date cuts, and doesn't fit", () => {
    const input = learnInput({
      goal: { dailyMinutes: 5, kind: "learn", targetDate: fromIsoDate("2026-09-30") },
      graph: { phases: [{ milestone: null, name: "Basics" }], skills: [skill("s1"), skill("s2")] },
      lessons: [
        lesson("l1", ["s1"], 6),
        lesson("l2", ["s1"], 6),
        lesson("l3", ["s2"], 6),
        lesson("l4", ["s2"], 6),
      ],
    });

    const coverage = coverageOf(input);

    expect(coverage.fits).toBe(false);
    expect(coverage.coveredShare).toBeLessThan(1);

    expect(
      coverage.skills.some(
        (entry) => entry.requiredRaw > 0 && entry.coveredRaw < entry.requiredRaw,
      ),
    ).toBe(true);
  });

  it("never counts a skill with no requirement data as covered", () => {
    // s3 has neither written lessons nor a stand-in size: it's in the goal, with nothing to plan.
    const input = learnInput({
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [skill("s1"), skill("s2"), skill("s3", { lessons: 0 })],
      },
    });

    const coverage = coverageOf(input);

    expect(coverage.skills.find((entry) => entry.skillId === "s3")).toStrictEqual({
      coveredRaw: 0,
      requiredRaw: 0,
      skillId: "s3",
      state: "unknown",
      worth: 1,
    });

    expect(coverage.fits).toBe(false);
    expect(coverage.coveredShare).toBeCloseTo(2 / 3);
  });

  it("credits a tested-out skill whole", () => {
    const input = learnInput({
      items: [
        existing({ id: "t1", lessonId: "l1", skillId: "s1", status: "testedOut" }),
        existing({ id: "t2", lessonId: "l2", position: 1, skillId: "s1", status: "testedOut" }),
      ],
    });

    const coverage = coverageOf(input);

    expect(coverage.skills.find((entry) => entry.skillId === "s1")).toMatchObject({
      state: "settled",
    });

    expect(coverage.coveredShare).toBe(1);
  });

  it("leaves an area the learner skips out of what it measures", () => {
    const input = learnInput({
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [skill("s1", { area: "Math" }), skill("s2", { area: "Law" })],
      },
      settings: parsePlanSettings({ skippedAreas: ["Law"], startDate: "2026-09-28" }),
    });

    expect(coverageOf(input).skills.map((entry) => entry.skillId)).toStrictEqual(["s1"]);
  });

  it("has no share when nothing in scope is worth anything", () => {
    const input = learnInput({
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [skill("s1", { weight: 0 }), skill("s2", { weight: 0 })],
      },
    });

    expect(coverageOf(input)).toMatchObject({ coveredShare: null, fits: false });
  });

  it("credits a finished lesson two skills share once to each, and once in the requirement", () => {
    const input = learnInput({
      items: [existing({ id: "d1", lessonId: "shared", skillId: "s1", status: "done" })],
      lessons: [lesson("shared", ["s1", "s2"], 5), lesson("l2", ["s1"]), lesson("l3", ["s2"])],
    });

    const summary = summarize(input);
    const skills = summary.coverage?.skills ?? [];

    expect(skills.find((entry) => entry.skillId === "s1")).toMatchObject({
      coveredRaw: 8,
      requiredRaw: 8,
    });

    expect(skills.find((entry) => entry.skillId === "s2")).toMatchObject({
      coveredRaw: 8,
      requiredRaw: 8,
    });

    expect(summary.requirement).toStrictEqual({ doneRaw: 5, remainingRaw: 6, totalRaw: 11 });
  });

  it("requires a base's core when the learner studies it essentially, and all of it in depth", () => {
    expect(requiredOf(null)).toBe(9 * DEFAULT_LESSON_MINUTES);
    expect(requiredOf("deep")).toBe(26 * DEFAULT_LESSON_MINUTES);
  });

  // An exam the learner studies whole: what doesn't fit before the exam goes on after it, held but
  // counted none by the deadline. Finishing one of those early is what changes what the plan covers.
  it("posts the goal's date it measured and the held lessons it counts short", () => {
    const input = learnInput({
      fullMockMinutes: 60,
      goal: { dailyMinutes: 10, kind: "exam", targetDate: fromIsoDate("2026-10-09") },
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [skill("s1", { area: "A", weight: 1 }), skill("s2", { area: "A", weight: 1 })],
      },
      lessons: ["l1", "l2", "l3", "l4", "l5", "l6"].map((lessonId, index) =>
        lesson(lessonId, [index % 2 === 0 ? "s1" : "s2"], 12),
      ),
      mockMinutes: 30,
      settings: parsePlanSettings({ fullCourse: true, startDate: "2026-09-28" }),
    });

    const built = buildPlan(input);
    const coverage = summarizeSelectedPlan({ built, examSubjects: null, input }).coverage;

    const after = built.items.flatMap((item) =>
      item.lessonId &&
      item.scheduledFor &&
      toIsoDate(item.scheduledFor) >= (coverage?.deadline ?? "")
        ? [item.lessonId]
        : [],
    );

    expect(coverage?.targetDate).toBe("2026-10-09");
    expect(coverage?.fits).toBe(false);
    expect(after.length).toBeGreaterThan(0);

    expect(coverage?.shortLessons.map((short) => short.lessonId)).toStrictEqual(after.toSorted());

    coverage?.shortLessons.forEach((short) => {
      expect(short).toMatchObject({ countedRaw: 0, requiredRaw: 12 });
    });
  });

  it("lists no short lesson when every lesson is laid before the date", () => {
    expect(coverageOf(learnInput()).shortLessons).toStrictEqual([]);
  });

  it("forecasts when the work left would be done at the plan's own days", () => {
    const summary = summarize(learnInput());

    const bigger = summarize(
      learnInput({ lessons: [...learnInput().lessons, lesson("l5", ["s2"], 30)] }),
    );

    const finishOf = ({ forecast }: typeof summary) =>
      forecast.finish.date ? fromIsoDate(forecast.finish.date).getTime() : Number.NaN;

    expect(summary.forecast.basis).toBe("estimated");
    expect(finishOf(summary)).toBeGreaterThanOrEqual(TODAY.getTime());
    expect(finishOf(bigger)).toBeGreaterThanOrEqual(finishOf(summary));

    const finished = learnInput({
      items: ["l1", "l2", "l3", "l4"].map((lessonId) =>
        existing({ id: lessonId, lessonId, skillId: "s1", status: "done" }),
      ),
    });

    expect(summarize(finished).forecast.finish).toStrictEqual({
      date: null,
      reason: "nothingLeft",
    });
  });

  it("raises the phase-dates card only for a build that kept dates that cost something", () => {
    const cut = learnInput({
      goal: { dailyMinutes: 5, kind: "learn", targetDate: fromIsoDate("2026-09-30") },
      lessons: [lesson("l1", ["s1"], 6), lesson("l2", ["s1"], 6), lesson("l3", ["s2"], 6)],
    });

    expect(summarize(cut).phaseDates).toStrictEqual({ structureKey: null, trigger: false });

    const kept = {
      ...cut,
      mode: "automatic" as const,
      phaseEnds: new Map([[0, fromIsoDate("2026-09-29")]]),
    };

    const built = buildPlan(kept);
    const phaseDates = summarizeSelectedPlan({ built, examSubjects: null, input: kept }).phaseDates;

    const costs =
      built.droppedSkillIds.length + built.strainedEnds.length + built.endsBeforeLessons.length > 0;

    expect(costs).toBe(true);
    expect(phaseDates.trigger).toBe(true);
    expect(phaseDates.structureKey).toMatch(/^[0-9a-f]{64}$/u);

    expect(
      summarizeSelectedPlan({ built, examSubjects: null, input: kept }).phaseDates,
    ).toStrictEqual(phaseDates);
  });

  // The Plan shows each base as the layout studied it, without reading the Library again.
  it("keeps what each base is, beside how the layout studied it", () => {
    const { input } = chooseBases(baseExamInput("deep"));
    const summary = summarizeSelectedPlan({ built: buildPlan(input), examSubjects: null, input });

    expect(summary.bases?.bases).toStrictEqual([
      expect.objectContaining({
        area: "Bio",
        choice: "deep",
        name: "Skill base",
        neededFor: ["top"],
        skillId: "base",
      }),
    ]);
  });
});
