import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { type ExistingPlanItem } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

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

function existing(
  attrs: Partial<ExistingPlanItem> & Pick<ExistingPlanItem, "id">,
): ExistingPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    kind: "lesson",
    lessonId: null,
    phase: 0,
    position: 0,
    scheduledFor: null,
    skillId: null,
    status: "todo",
    titleSnapshot: "Existing",
    ...attrs,
  };
}

function planInput(attrs: Partial<BuildPlanInput> = {}): BuildPlanInput {
  return {
    goal: { dailyMinutes: 12, kind: "learn", targetDate: null },
    graph: {
      phases: [
        { milestone: "Use the basics", name: "Basics" },
        { milestone: null, name: "Advanced" },
      ],
      skills: [skill("s1"), skill("s2"), skill("s3", { phase: 1 })],
    },
    items: [],
    lessons: [lesson("l1", ["s1"]), lesson("l2", ["s1"]), lesson("l3", ["s3"])],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({}),
    today: TODAY,
    ...attrs,
  };
}

function summarize(input: BuildPlanInput) {
  return buildPlan(input).items.map((item) => ({
    date: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
    key: item.key,
    phase: item.phase,
  }));
}

describe(buildPlan, () => {
  it("lays lessons, placeholders and phase checkpoints on days at the learner's time", () => {
    const plan = buildPlan(planInput());

    expect(summarize(planInput())).toStrictEqual([
      { date: "2026-09-28", key: "lesson:l1", phase: 0 },
      { date: "2026-09-28", key: "lesson:l2", phase: 0 },
      { date: "2026-09-29", key: "skill:s2", phase: 0 },
      { date: "2026-09-30", key: "boss:0", phase: 0 },
      { date: "2026-10-01", key: "lesson:l3", phase: 1 },
      { date: "2026-10-02", key: "boss:1", phase: 1 },
    ]);

    expect(plan.items.find((item) => item.key === "skill:s2")).toMatchObject({
      kind: "lesson",
      lessonId: null,
      skillId: "s2",
      titleSnapshot: "Skill s2",
    });

    expect(plan.phases).toStrictEqual([
      {
        endDate: "2026-09-30",
        kind: "learn",
        milestone: "Use the basics",
        minutes: 34,
        name: "Basics",
        startDate: "2026-09-28",
      },
      {
        endDate: "2026-10-02",
        kind: "learn",
        milestone: null,
        minutes: 16,
        name: "Advanced",
        startDate: "2026-10-01",
      },
    ]);

    expect(plan.estimate).toStrictEqual({
      endDate: fromIsoDate("2026-10-02"),
      remainingMinutes: 50,
      totalMinutes: 50,
    });
  });

  it("adds a weekly checkpoint from the second week on, which takes that day's time", () => {
    const lessons = Array.from({ length: 30 }, (_, index) => lesson(`l${index}`, ["s1"]));
    const plan = buildPlan(planInput({ lessons }));
    const checkpoints = plan.items.filter((item) => item.kind === "checkpoint");

    expect(checkpoints.map((item) => toIsoDate(item.scheduledFor ?? TODAY))).toStrictEqual([
      "2026-10-11",
    ]);

    expect(
      plan.items.some(
        (item) => item.kind === "lesson" && toIsoDate(item.scheduledFor ?? TODAY) === "2026-10-11",
      ),
    ).toBe(false);
  });

  it("moves the week's checkpoint to Monday and gives Sunday its lessons back", () => {
    const lessons = Array.from({ length: 30 }, (_, index) => lesson(`l${index}`, ["s1"]));

    const plan = buildPlan(
      planInput({
        lessons,
        settings: parsePlanSettings({ movedEvents: [{ from: "2026-10-11", to: "2026-10-12" }] }),
      }),
    );

    const checkpoints = plan.items.filter((item) => item.kind === "checkpoint");

    expect(
      checkpoints.map((item) => [item.key, toIsoDate(item.scheduledFor ?? TODAY)]),
    ).toStrictEqual([["checkpoint:2026-10-12", "2026-10-12"]]);

    expect(
      plan.items.some(
        (item) => item.kind === "lesson" && toIsoDate(item.scheduledFor ?? TODAY) === "2026-10-11",
      ),
    ).toBe(true);
  });

  it("never undoes finished work and re-flows missed days from today", () => {
    const items = [
      existing({
        id: "done",
        lessonId: "l1",
        scheduledFor: fromIsoDate("2026-09-21"),
        status: "done",
      }),
      existing({ id: "missed", lessonId: "l2", scheduledFor: fromIsoDate("2026-09-22") }),
      existing({ id: "later", lessonId: "l3", phase: 1, scheduledFor: fromIsoDate("2026-09-24") }),
    ];

    const plan = buildPlan(planInput({ items }));

    expect(plan.items[0]).toMatchObject({
      id: "done",
      scheduledFor: fromIsoDate("2026-09-21"),
      status: "done",
    });

    expect(plan.items.find((item) => item.key === "lesson:l2")).toMatchObject({
      id: "missed",
      scheduledFor: TODAY,
    });

    expect(plan.items.find((item) => item.key === "lesson:l3")?.id).toBe("later");
    expect(plan.items.filter((item) => item.key === "lesson:l1")).toHaveLength(1);
  });

  it("keeps this week as it is on automatic runs and moves only what comes after", () => {
    const items = [
      existing({ id: "this-week", lessonId: "l2", scheduledFor: fromIsoDate("2026-10-02") }),
      existing({
        id: "next-week",
        lessonId: "l3",
        phase: 1,
        scheduledFor: fromIsoDate("2026-10-09"),
      }),
    ];

    const plan = buildPlan(planInput({ items, mode: "automatic" }));

    expect(plan.items.find((item) => item.id === "this-week")?.scheduledFor).toStrictEqual(
      fromIsoDate("2026-10-02"),
    );

    expect(plan.items.find((item) => item.key === "lesson:l1")?.scheduledFor).toStrictEqual(
      fromIsoDate("2026-10-05"),
    );
  });

  it("leaves skipped areas out and puts focused areas first within their phase", () => {
    const graph = {
      phases: [{ milestone: null, name: "Only" }],
      skills: [
        skill("a", { area: "Physics" }),
        skill("b", { area: "Math" }),
        skill("c", { area: "Chemistry" }),
      ],
    };

    const settings = parsePlanSettings({ focusAreas: ["Math"], skippedAreas: ["Chemistry"] });

    expect(
      summarize(planInput({ graph, lessons: [], settings })).map((item) => item.key),
    ).toStrictEqual(["skill:b", "skill:a", "boss:0"]);
  });

  it("takes longer through a light week", () => {
    const lessons = Array.from({ length: 12 }, (_, index) => lesson(`l${index}`, ["s1"]));
    const normal = buildPlan(planInput({ lessons }));

    const light = buildPlan(
      planInput({
        lessons,
        settings: parsePlanSettings({
          lightWeeks: [{ endDate: "2026-10-04", startDate: "2026-09-28" }],
        }),
      }),
    );

    expect(light.estimate.endDate?.getTime()).toBeGreaterThan(
      normal.estimate.endDate?.getTime() ?? 0,
    );
  });
});

describe("exam plans", () => {
  const examStart = fromIsoDate("2026-09-23");

  function examInput(attrs: Partial<BuildPlanInput> = {}): BuildPlanInput {
    return planInput({
      goal: { dailyMinutes: 45, kind: "exam", targetDate: fromIsoDate("2026-11-08") },
      graph: {
        phases: [{ milestone: null, name: "Everything" }],
        skills: [
          skill("s1", { weight: 5 }),
          skill("s2", { weight: 1 }),
          skill("s3", { weight: 3 }),
        ],
      },
      lessons: [],
      prerequisites: new Map([["s3", ["s2"]]]),
      settings: parsePlanSettings({
        startDate: "2026-09-23",
        weekdayMinutes: [0, 45, 45, 45, 45, 45, 45],
      }),
      today: examStart,
      ...attrs,
    });
  }

  it("orders skills by priority, keeps prerequisites first, and stops new lessons at the final stretch", () => {
    const plan = buildPlan(examInput());
    const lessons = plan.items.filter((item) => item.kind === "lesson");

    expect(lessons.map((item) => item.skillId)).toStrictEqual(["s1", "s2", "s3"]);

    expect(
      lessons.every((item) => (item.scheduledFor ?? examStart) < fromIsoDate("2026-11-01")),
    ).toBe(true);

    expect(plan.phases.map((phase) => phase.kind)).toStrictEqual([
      "foundations",
      "gaps",
      "practice",
      "finalStretch",
    ]);
  });

  it("puts each lesson in the exam phase of the day it's due", () => {
    const lessons = Array.from({ length: 150 }, (_, index) => lesson(`l${index}`, ["s1"]));

    const plan = buildPlan(
      examInput({
        graph: {
          phases: [{ milestone: null, name: "Everything" }],
          skills: [skill("s1", { weight: 5 })],
        },
        lessons,
        prerequisites: new Map(),
      }),
    );

    const phaseOf = (date: string) =>
      plan.items.find(
        (item) => item.kind === "lesson" && toIsoDate(item.scheduledFor ?? examStart) === date,
      )?.phase;

    expect(phaseOf("2026-09-23")).toBe(0);
    expect(phaseOf("2026-10-05")).toBe(1);
    expect(plan.phases[1]?.minutes).toBeGreaterThan(0);
  });

  it("plans weekly mocks from the gaps phase, review days at the end and a light day before", () => {
    const plan = buildPlan(examInput());

    const datesOf = (kind: string) =>
      plan.items
        .filter((item) => item.kind === kind)
        .map((item) => toIsoDate(item.scheduledFor ?? examStart));

    expect(datesOf("mock")).toStrictEqual(["2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01"]);

    expect(datesOf("review")).toStrictEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);

    expect(plan.items.find((item) => item.key === "review:2026-11-07")?.minutes).toBe(15);
    expect(datesOf("boss")).toStrictEqual(["2026-10-04", "2026-10-20", "2026-10-31"]);
  });

  it("says what fits in the time and what more time would cover", () => {
    const skills = Array.from({ length: 6 }, (_, index) =>
      skill(`s${index}`, { lessons: 40, weight: index === 0 ? 5 : 1 }),
    );

    const input = examInput({
      goal: { dailyMinutes: 20, kind: "exam", targetDate: fromIsoDate("2026-10-23") },
      graph: { phases: [{ milestone: null, name: "Everything" }], skills },
      prerequisites: new Map(),
      settings: parsePlanSettings({ startDate: "2026-09-23" }),
    });

    const built = buildPlan(input);
    const feasibility = getPlanFeasibility({ built, input });

    expect(feasibility.fits).toBe(false);
    expect(built.droppedSkillIds).not.toContain("s0");
    expect(feasibility.coveredShare).toBeGreaterThan(0);
    expect(feasibility.coveredShare).toBeLessThan(1);
    expect(feasibility.recommendedMinutes).toBeGreaterThan(20);

    const more = {
      ...input,
      goal: { ...input.goal, dailyMinutes: feasibility.recommendedMinutes ?? 0 },
    };

    expect(buildPlan(more).droppedSkillIds).toStrictEqual([]);

    expect(
      buildPlan({
        ...input,
        goal: { ...input.goal, dailyMinutes: (feasibility.recommendedMinutes ?? 0) - 5 },
      }).droppedSkillIds.length,
    ).toBeGreaterThan(0);
  });

  it("offers an end date at more time a day when there's no deadline", () => {
    const input = planInput();
    const feasibility = getPlanFeasibility({ built: buildPlan(input), input });

    expect(feasibility).toMatchObject({ coveredShare: 1, deadline: null, fits: true });
    expect(feasibility.alternative?.dailyMinutes).toBe(60);

    expect(feasibility.alternative?.endDate?.getTime()).toBeLessThanOrEqual(
      fromIsoDate("2026-10-02").getTime(),
    );
  });
});

type DatedPhase = { endDate: string | null; startDate: string | null };

/**
 * Where phases break their order: a phase without dates or ending before it starts, and one that
 * doesn't start after the one before it ends. Empty when they run one after another.
 */
function findPhaseOverlaps(phases: readonly DatedPhase[]): string[] {
  return phases.flatMap((phase, index) => {
    const before = phases[index - 1];
    const { endDate, startDate } = phase;

    return [
      (!startDate || !endDate || endDate < startDate) &&
        `phase ${index} runs from ${startDate} to ${endDate}`,
      before?.endDate &&
        startDate &&
        startDate <= before.endDate &&
        `phase ${index} starts ${startDate}, before phase ${index - 1} ends ${before.endDate}`,
    ].filter((problem): problem is string => typeof problem === "string");
  });
}

describe("learn phases", () => {
  const twoPhases = [
    { milestone: null, name: "First" },
    { milestone: null, name: "Second" },
  ];

  it("keeps phases in order when a prerequisite points back against the graph's order", () => {
    // Skills are shared, so another goal's edges can close a cycle: "a" needs "c", listed after it.
    const plan = buildPlan(
      planInput({
        graph: {
          phases: twoPhases,
          skills: [skill("a"), skill("b"), skill("c"), skill("d", { phase: 1 })],
        },
        lessons: [],
        prerequisites: new Map([
          ["a", ["c"]],
          ["b", ["a"]],
          ["c", ["b"]],
        ]),
      }),
    );

    expect(
      plan.items.filter((item) => item.kind === "lesson").map((item) => item.skillId),
    ).toStrictEqual(["a", "b", "c", "d"]);

    expect(findPhaseOverlaps(plan.phases)).toStrictEqual([]);
  });

  it("starts the next phase on a new day after a phase's checkpoint", () => {
    const input = planInput({ goal: { dailyMinutes: 30, kind: "learn", targetDate: null } });

    expect(summarize(input)).toStrictEqual([
      { date: "2026-09-28", key: "lesson:l1", phase: 0 },
      { date: "2026-09-28", key: "lesson:l2", phase: 0 },
      { date: "2026-09-28", key: "skill:s2", phase: 0 },
      { date: "2026-09-29", key: "boss:0", phase: 0 },
      { date: "2026-09-30", key: "lesson:l3", phase: 1 },
      { date: "2026-09-30", key: "boss:1", phase: 1 },
    ]);

    expect(findPhaseOverlaps(buildPlan(input).phases)).toStrictEqual([]);
  });

  it("starts the first phase when the plan starts, while its first stand-in takes days", () => {
    const plan = buildPlan(
      planInput({
        graph: { phases: twoPhases, skills: [skill("s1", { lessons: 6 })] },
        lessons: [],
      }),
    );

    expect(plan.phases[0]?.startDate).toBe("2026-09-28");

    expect(plan.items.find((item) => item.kind === "lesson")?.scheduledFor).not.toStrictEqual(
      new Date("2026-09-28T00:00:00Z"),
    );
  });

  it("starts a phase the day after the one before ends, while its first stand-in takes days", () => {
    const plan = buildPlan(
      planInput({
        graph: {
          phases: twoPhases,
          skills: [skill("s1", { lessons: 1 }), skill("s2", { lessons: 6, phase: 1 })],
        },
        lessons: [lesson("l1", ["s1"])],
      }),
    );

    expect(plan.phases.map((phase) => [phase.startDate, phase.endDate])).toStrictEqual([
      ["2026-09-28", "2026-09-29"],
      ["2026-09-30", "2026-10-03"],
    ]);
  });

  it("dates a phase by what's left to do in it, not by lessons a test-out finished early", () => {
    const plan = buildPlan(
      planInput({
        items: [
          existing({
            completedAt: TODAY,
            id: "tested-out",
            lessonId: "l3",
            phase: 1,
            scheduledFor: fromIsoDate("2026-10-05"),
            status: "testedOut",
          }),
        ],
        lessons: [
          lesson("l1", ["s1"]),
          lesson("l2", ["s1"]),
          lesson("l3", ["s3"]),
          lesson("l4", ["s3"]),
        ],
      }),
    );

    expect(findPhaseOverlaps(plan.phases)).toStrictEqual([]);
  });
});

/**
 * The course outlines one short unit for each situation, a slice of what the graph says reaching
 * its level takes: six lessons teach greeting and introducing yourself, five the interview.
 */
function languageInput(attrs: Partial<BuildPlanInput> = {}): BuildPlanInput {
  return planInput({
    goal: { dailyMinutes: 30, kind: "language", targetDate: null },
    graph: {
      phases: [
        { milestone: null, name: "Arrival" },
        { milestone: null, name: "Work" },
      ],
      skills: [
        skill("greet", { lessons: 18 }),
        skill("introduce", { lessons: 20 }),
        skill("interview", { lessons: 30, phase: 1 }),
      ],
    },
    lessons: [
      ...Array.from({ length: 6 }, (_, index) =>
        lesson(`arrival-${index}`, ["greet", "introduce"]),
      ),
      ...Array.from({ length: 5 }, (_, index) => lesson(`work-${index}`, ["interview"])),
    ],
    ...attrs,
  });
}

function lessonMinutes(input: BuildPlanInput): number {
  return buildPlan(input)
    .items.filter((item) => item.kind === "lesson")
    .reduce((total, item) => total + item.minutes, 0);
}

describe("language plans", () => {
  it("plans each situation at the graph's size, the part not outlined yet as a stand-in", () => {
    const input = languageInput();
    const keys = buildPlan(input).items.map((item) => item.key);

    expect(keys.filter((key) => key.startsWith("skill:"))).toStrictEqual([
      "skill:greet",
      "skill:introduce",
      "skill:interview",
    ]);

    expect(keys.indexOf("skill:greet")).toBe(keys.indexOf("lesson:arrival-5") + 1);

    // 6 outlined lessons teach both arrival skills and 5 the interview: 12 + 14 + 25 lessons left.
    const lessons = 6 + 5 + 12 + 14 + 25;
    expect(lessonMinutes(input)).toBeCloseTo((lessons * 3) / 0.5);
  });

  it("says when the date is too close to cover every situation at the learner's time", () => {
    const input = languageInput({
      goal: { dailyMinutes: 10, kind: "language", targetDate: fromIsoDate("2026-10-19") },
    });

    const built = buildPlan(input);
    const feasibility = getPlanFeasibility({ built, input });

    expect(feasibility.fits).toBe(false);
    expect(feasibility.coveredShare).toBeLessThan(1);
    expect(feasibility.recommendedMinutes).toBeGreaterThan(10);

    expect(
      built.items.every((item) => (item.scheduledFor ?? TODAY) < fromIsoDate("2026-10-19")),
    ).toBe(true);
  });
});

function lessonsFor(skillId: string, count: number): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => lesson(`${skillId}-${index}`, [skillId]));
}

/** Each stand-in's skill and the lessons it plans, at 3 minutes a lesson and half the day's time. */
function standIns(plan: ReturnType<typeof buildPlan>) {
  return plan.items
    .filter((item) => item.kind === "lesson" && !item.lessonId)
    .map((item) => [item.skillId, Math.round((item.minutes * 0.5) / 3)]);
}

function windows(built: ReturnType<typeof buildPlan>) {
  return built.phases.map((phase) => [phase.kind, phase.startDate, phase.endDate]);
}

describe("big goals of any kind", () => {
  it("sizes a big learn skill from the graph, and a skill a few lessons short from its outline", () => {
    // Quantum-like: skills of 30 and 40 lessons with 5 and 6 outlined, and one only 3 lessons short.
    const plan = buildPlan(
      planInput({
        goal: { dailyMinutes: 30, kind: "learn", targetDate: null },
        graph: {
          phases: [{ milestone: null, name: "Foundations" }],
          skills: [
            skill("waves", { lessons: 30 }),
            skill("spin", { lessons: 40 }),
            skill("units", { lessons: 8 }),
          ],
        },
        lessons: [...lessonsFor("waves", 5), ...lessonsFor("spin", 6), ...lessonsFor("units", 5)],
      }),
    );

    expect(standIns(plan)).toStrictEqual([
      ["waves", 25],
      ["spin", 34],
    ]);

    const keys = plan.items.map((item) => item.key);
    expect(keys.indexOf("skill:waves")).toBe(keys.indexOf("lesson:waves-4") + 1);
  });

  it("keeps a dated exam plan's windows, puts stand-ins after their skill's lessons and says what doesn't fit", () => {
    const skills = [
      skill("math", { area: "Math", lessons: 100, weight: 5 }),
      skill("law", { area: "Law", lessons: 100, weight: 3 }),
      skill("reading", { area: "Portuguese", lessons: 100, weight: 1 }),
    ];

    const input = planInput({
      goal: { dailyMinutes: 45, kind: "exam", targetDate: fromIsoDate("2026-11-08") },
      graph: { phases: [{ milestone: null, name: "Everything" }], skills },
      lessons: skills.flatMap((item) => lessonsFor(item.skillId, 5)),
      settings: parsePlanSettings({ startDate: "2026-09-28" }),
    });

    const plan = buildPlan(input);

    const outlinedOnly = buildPlan({
      ...input,
      graph: { ...input.graph, skills: skills.map((item) => ({ ...item, lessons: 5 })) },
    });

    expect(windows(plan)).toStrictEqual(windows(outlinedOnly));

    const finalStretch = plan.phases.find((phase) => phase.kind === "finalStretch")?.startDate;
    const lessons = plan.items.filter((item) => item.kind === "lesson");

    expect(
      lessons.every((item) => toIsoDate(item.scheduledFor ?? TODAY) < (finalStretch ?? "")),
    ).toBe(true);

    const keys = plan.items.map((item) => item.key);
    expect(keys.indexOf("skill:math")).toBeGreaterThan(keys.indexOf("lesson:math-4"));

    const feasibility = getPlanFeasibility({ built: plan, input });

    expect(feasibility).toMatchObject({ deadline: fromIsoDate(finalStretch ?? ""), fits: false });
    expect(feasibility.coveredShare).toBeLessThan(1);
    expect(getPlanFeasibility({ built: outlinedOnly, input }).fits).toBe(true);
  });
});
