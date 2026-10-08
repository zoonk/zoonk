import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, daysBetween, fromIsoDate, toIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { type ExistingPlanItem, type PlannedItem } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { DEFAULT_LESSON_MINUTES, type PlannerLesson } from "./plan-units";

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
      { date: "2026-09-30", key: "skill:s2", phase: 0 },
      { date: "2026-10-01", key: "boss:0", phase: 0 },
      { date: "2026-10-02", key: "lesson:l3", phase: 1 },
      { date: "2026-10-03", key: "boss:1", phase: 1 },
    ]);

    expect(plan.items.find((item) => item.key === "skill:s2")).toMatchObject({
      kind: "lesson",
      lessonId: null,
      skillId: "s2",
      titleSnapshot: "Skill s2",
    });

    expect(plan.phases).toStrictEqual([
      {
        endDate: "2026-10-01",
        kind: "learn",
        milestone: "Use the basics",
        minutes: 38,
        name: "Basics",
        startDate: "2026-09-28",
      },
      {
        endDate: "2026-10-03",
        kind: "learn",
        milestone: null,
        minutes: 16,
        name: "Advanced",
        startDate: "2026-10-02",
      },
    ]);

    expect(plan.estimate).toStrictEqual({
      endDate: fromIsoDate("2026-10-03"),
      remainingMinutes: 54,
      totalMinutes: 54,
    });
  });

  it("adds a weekly checkpoint from the second week on, which takes that day's time", () => {
    const lessons = Array.from({ length: 30 }, (_, index) => lesson(`l${index}`, ["s1"]));
    const plan = buildPlan(planInput({ lessons }));
    const checkpoints = plan.items.filter((item) => item.kind === "checkpoint");

    expect(checkpoints.map((item) => toIsoDate(item.scheduledFor ?? TODAY))).toStrictEqual([
      "2026-10-11",
      "2026-10-18",
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
    ).toStrictEqual([
      ["checkpoint:2026-10-12", "2026-10-12"],
      ["checkpoint:2026-10-18", "2026-10-18"],
    ]);

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

  it("teaches a topic once when two courses wrote a lesson with the same title", () => {
    const lessons = [
      { ...lesson("physics-ohm", ["s1"]), title: "Lei de Ohm" },
      { ...lesson("enem-ohm", ["s1"]), title: "lei de ohm " },
      { ...lesson("ohm-variation", ["s1"]), title: "Lei de Ohm e variação de grandezas" },
    ];

    const plan = buildPlan(planInput({ lessons }));
    const keys = plan.items.map((item) => item.key);

    expect(keys).toContain("lesson:physics-ohm");
    expect(keys).toContain("lesson:ohm-variation");
    expect(keys).not.toContain("lesson:enem-ohm");
  });

  it("doesn't plan a lesson again under another course once one with its title is done", () => {
    const items = [
      existing({
        id: "done",
        lessonId: "enem-ohm",
        scheduledFor: fromIsoDate("2026-09-21"),
        status: "done",
        titleSnapshot: "Lei de Ohm",
      }),
    ];

    const lessons = [
      { ...lesson("physics-ohm", ["s1"]), title: "Lei de Ohm" },
      { ...lesson("enem-ohm", ["s1"]), title: "Lei de Ohm" },
    ];

    const keys = buildPlan(planInput({ items, lessons })).items.map((item) => item.key);

    expect(keys.filter((key) => key.endsWith("-ohm"))).toStrictEqual(["lesson:enem-ohm"]);
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

  function datesOf({ kind, plan }: { kind: string; plan: ReturnType<typeof buildPlan> }) {
    return plan.items
      .filter((item) => item.kind === kind)
      .map((item) => toIsoDate(item.scheduledFor ?? examStart));
  }

  it("plans weekly mocks from the gaps phase, review days at the end and a light day before", () => {
    // Enough lessons to fill every day before the final stretch: no spare week for more mocks.
    const lessons = Array.from({ length: 400 }, (_, index) => lesson(`l${index}`, ["s1"]));
    const plan = buildPlan(examInput({ lessons }));

    // Sunday is the learner's rest day, though the exam is on a Sunday: Saturdays take the mocks.
    expect(datesOf({ kind: "mock", plan })).toStrictEqual([
      "2026-10-10",
      "2026-10-17",
      "2026-10-24",
      "2026-10-31",
    ]);

    const events = plan.items.filter((item) => ["boss", "mock"].includes(item.kind));
    expect(events.filter((item) => item.scheduledFor?.getUTCDay() === 0)).toStrictEqual([]);

    expect(datesOf({ kind: "review", plan }).filter((date) => date >= "2026-11-02")).toStrictEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);

    expect(plan.items.find((item) => item.key === "review:2026-11-07")?.minutes).toBe(15);

    // A phase that ends on the rest day closes the day before; one that ends on a mock day too.
    expect(datesOf({ kind: "boss", plan })).toStrictEqual([
      "2026-10-03",
      "2026-10-20",
      "2026-10-30",
    ]);
  });

  it("keeps the weekly mock days away from the exam when the learner's last study day is near it", () => {
    // Saturday and Sunday rest: Fridays take the mocks, and the Friday two days before the
    // Sunday exam is review, as a spare mock would be.
    const lessons = Array.from({ length: 400 }, (_, index) => lesson(`l${index}`, ["s1"]));

    const plan = buildPlan(
      examInput({
        lessons,
        settings: parsePlanSettings({
          startDate: "2026-09-23",
          weekdayMinutes: [0, 45, 45, 45, 45, 45, 0],
        }),
      }),
    );

    const mocks = datesOf({ kind: "mock", plan });

    expect(mocks.at(-1)).toBe("2026-10-30");
    expect(mocks.every((date) => fromIsoDate(date).getUTCDay() === 5)).toBe(true);
    expect(datesOf({ kind: "review", plan })).toContain("2026-11-06");
  });

  it("spends spare weeks on more mocks in the final stretch, days apart from the others", () => {
    // Six lessons end in the first days: weeks of practice days before the final stretch.
    const plan = buildPlan(
      examInput({
        goal: { dailyMinutes: 45, kind: "exam", targetDate: fromIsoDate("2026-12-20") },
      }),
    );

    const mocks = datesOf({ kind: "mock", plan });
    const finalStretch = plan.phases.find((phase) => phase.kind === "finalStretch");
    const inFinalStretch = mocks.filter((date) => date >= (finalStretch?.startDate ?? ""));

    // The week's mock (Saturday: Sunday is the rest day), and one more in each final-stretch week,
    // three days from any other mock (the last practice week's on 5 December) and from the exam.
    expect(finalStretch?.startDate).toBe("2026-12-07");
    expect(inFinalStretch).toStrictEqual(["2026-12-08", "2026-12-12", "2026-12-15"]);

    const extra = plan.items.find((item) => item.key === "mock:2026-12-08");
    const weekly = plan.items.find((item) => item.key === "mock:2026-12-12");

    expect(extra).toMatchObject({ kind: "mock", minutes: weekly?.minutes });
    expect(datesOf({ kind: "review", plan })).not.toContain("2026-12-08");
  });

  it("moves a spare mock like the weekly one when the learner asks", () => {
    const plan = buildPlan(
      examInput({
        goal: { dailyMinutes: 45, kind: "exam", targetDate: fromIsoDate("2026-12-20") },
        settings: parsePlanSettings({
          movedEvents: [{ from: "2026-12-08", to: "2026-12-09" }],
          startDate: "2026-09-23",
          weekdayMinutes: [0, 45, 45, 45, 45, 45, 45],
        }),
      }),
    );

    expect(datesOf({ kind: "mock", plan })).toContain("2026-12-09");
    expect(datesOf({ kind: "mock", plan })).not.toContain("2026-12-08");
    expect(datesOf({ kind: "review", plan })).toContain("2026-12-08");
  });

  it("says what fits in the time and what more time would cover", () => {
    const skills = Array.from({ length: 6 }, (_, index) =>
      skill(`s${index}`, { lessons: 40, weight: index === 0 ? 5 : 1 }),
    );

    const input = examInput({
      goal: { dailyMinutes: 40, kind: "exam", targetDate: fromIsoDate("2026-10-23") },
      graph: { phases: [{ milestone: null, name: "Everything" }], skills },
      prerequisites: new Map(),
      settings: parsePlanSettings({ startDate: "2026-09-23" }),
    });

    const built = buildPlan(input);
    const feasibility = getPlanFeasibility({ input });

    expect(feasibility.fits).toBe(false);

    // Every skill keeps its core; the one worth more gets more of its depth.
    const covered = new Map(
      built.skillMinutes.map((entry) => [entry.skillId, entry.covered / entry.total]),
    );

    expect(built.waitingSkillIds).toStrictEqual([]);
    expect(covered.get("s0")).toBeGreaterThan(covered.get("s1") ?? 1);
    expect(feasibility.coveredShare).toBeGreaterThan(0);
    expect(feasibility.coveredShare).toBeLessThan(1);
    expect(feasibility.recommendedMinutes).toBeGreaterThan(40);
    expect(feasibility.maximum).toBeNull();

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
    const feasibility = getPlanFeasibility({ input });

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
      ["2026-09-30", "2026-10-04"],
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

    // 6 outlined lessons (3 minutes each) teach the two arrival skills, three each, and 5 the
    // interview: 15 + 17 + 25 lessons left, as stand-ins.
    const outlined = (6 + 5) * 3;
    const standInMinutes = (15 + 17 + 25) * DEFAULT_LESSON_MINUTES;
    expect(lessonMinutes(input)).toBeCloseTo((outlined + standInMinutes) / 0.5);
  });

  it("says when the date is too close to cover every situation at the learner's time", () => {
    const input = languageInput({
      goal: { dailyMinutes: 10, kind: "language", targetDate: fromIsoDate("2026-10-19") },
    });

    const built = buildPlan(input);
    const feasibility = getPlanFeasibility({ input });

    expect(feasibility.fits).toBe(false);
    expect(feasibility.coveredShare).toBeLessThan(1);
    expect(feasibility.recommendedMinutes).toBeGreaterThan(10);

    expect(
      built.items.every((item) => (item.scheduledFor ?? TODAY) < fromIsoDate("2026-10-19")),
    ).toBe(true);
  });

  it("keeps practicing to its date when its lessons end weeks before, so it never ends early", () => {
    const interview = fromIsoDate("2027-01-06");

    const input = languageInput({
      goal: { dailyMinutes: 45, kind: "language", targetDate: interview },
    });

    const built = buildPlan(input);
    const lessons = built.items.filter((item) => item.kind === "lesson");
    const lastLesson = lessons.at(-1)?.scheduledFor ?? TODAY;
    const end = built.estimate.endDate ?? TODAY;

    // The lessons fit in weeks; the weekly challenges go on until the interview's week.
    expect(lastLesson.getTime()).toBeLessThan(fromIsoDate("2026-11-30").getTime());
    expect(end.getTime()).toBeGreaterThan(fromIsoDate("2026-12-27").getTime());
    expect(end.getTime()).toBeLessThan(interview.getTime());
    expect(getPlanFeasibility({ input }).endDate?.getTime()).toBe(end.getTime());

    // No empty weeks: every day after the last lesson practices or holds the week's challenge.
    const busy = new Set(built.items.map((item) => toIsoDate(item.scheduledFor ?? TODAY)));

    const spare = Array.from({ length: daysBetween(lastLesson, interview) - 1 }, (_, index) =>
      toIsoDate(addDays(lastLesson, index + 1)),
    );

    expect(spare.filter((date) => !busy.has(date))).toStrictEqual([]);

    expect(
      built.items.filter(
        (item) => item.kind === "review" && (item.scheduledFor ?? TODAY) > lastLesson,
      ).length,
    ).toBeGreaterThan(20);
  });
});

function lessonsFor(skillId: string, count: number): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => lesson(`${skillId}-${index}`, [skillId]));
}

/** Each stand-in's skill and the lessons it plans, at half the day's time. */
function standIns(plan: ReturnType<typeof buildPlan>) {
  return plan.items
    .filter((item) => item.kind === "lesson" && !item.lessonId)
    .map((item) => [item.skillId, Math.round((item.minutes * 0.5) / DEFAULT_LESSON_MINUTES)]);
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

    const feasibility = getPlanFeasibility({ input });

    expect(feasibility).toMatchObject({ deadline: fromIsoDate(finalStretch ?? ""), fits: false });
    expect(feasibility.coveredShare).toBeLessThan(1);
    // Coverage reads the graph's sizes: a graph that asks only the outlined lessons fits.
    const smallerGraph = {
      ...input,
      graph: { ...input.graph, skills: skills.map((item) => ({ ...item, lessons: 5 })) },
    };

    expect(getPlanFeasibility({ input: smallerGraph }).fits).toBe(true);
  });
});

describe("a plan's first day", () => {
  it("has study time even when the learner rests on that weekday, and rests from the next week on", () => {
    // Monday off, and the plan starts on a Monday: day one still studies.
    const restsOnMonday = [12, 0, 12, 12, 12, 12, 12];
    const lessons = Array.from({ length: 12 }, (_, index) => lesson(`l${index}`, ["s1"]));

    const plan = buildPlan(
      planInput({
        lessons,
        settings: parsePlanSettings({ startDate: "2026-09-28", weekdayMinutes: restsOnMonday }),
      }),
    );

    const lessonDays = new Set(
      plan.items
        .filter((item) => item.kind === "lesson")
        .map((item) => toIsoDate(item.scheduledFor ?? TODAY)),
    );

    expect(lessonDays.has("2026-09-28")).toBe(true);
    // The next Monday rests again: only the weekly checkpoint, which goes on a rest day, is there.
    expect(lessonDays.has("2026-10-05")).toBe(false);
  });
});

describe("a plan no daily time can cover", () => {
  it("says what the most time a day covers, and nothing to switch to once the learner gives it", () => {
    const skills = Array.from({ length: 40 }, (_, index) => skill(`s${index}`, { lessons: 40 }));

    const input = planInput({
      goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-10-12") },
      graph: { phases: [{ milestone: null, name: "Everything" }], skills },
      settings: parsePlanSettings({ startDate: "2026-09-28" }),
    });

    const feasibility = getPlanFeasibility({ input });

    expect(feasibility).toMatchObject({ fits: false, recommendedMinutes: null });
    expect(feasibility.maximum?.dailyMinutes).toBe(240);
    expect(feasibility.maximum?.coveredShare).toBeGreaterThan(feasibility.coveredShare);
    expect(feasibility.maximum?.coveredShare).toBeLessThan(1);

    const atMaximum = { ...input, goal: { ...input.goal, dailyMinutes: 240 } };

    expect(getPlanFeasibility({ input: atMaximum }).maximum).toBeNull();
  });
});

/** Research, design and testing, then the portfolio and the job search, which get the job. */
function careerInput(dailyMinutes: number) {
  return planInput({
    goal: { dailyMinutes, kind: "learn", targetDate: fromIsoDate("2026-10-12") },
    graph: {
      phases: [
        { milestone: null, name: "Research" },
        { milestone: null, name: "Design" },
        { milestone: null, name: "Testing" },
        { milestone: null, name: "Portfolio and job search" },
      ],
      skills: [
        skill("research", { area: "Research", lessons: 8 }),
        skill("design", { area: "Design", lessons: 8, phase: 1 }),
        skill("testing", { area: "Testing", lessons: 8, phase: 2 }),
        skill("portfolio", { area: "Portfolio", lessons: 4, outcome: true, phase: 3 }),
        skill("job-search", { area: "Job search", lessons: 3, outcome: true, phase: 3 }),
      ],
    },
    lessons: [
      ...lessonsFor("research", 8),
      ...lessonsFor("design", 8),
      ...lessonsFor("testing", 8),
      ...lessonsFor("portfolio", 4),
      ...lessonsFor("job-search", 3),
    ],
    settings: parsePlanSettings({ startDate: "2026-09-28" }),
  });
}

function plannedLessons(plan: ReturnType<typeof buildPlan>) {
  return plan.items.flatMap((item) => (item.lessonId ? [item.lessonId] : []));
}

function dateOf(item: { scheduledFor: Date | null }): string {
  return toIsoDate(item.scheduledFor ?? TODAY);
}

describe("a career goal short on time", () => {
  it("keeps the portfolio and the job search whole, every module's core in, and leaves out depth", () => {
    const input = careerInput(12);
    const plan = buildPlan(input);
    const planned = plannedLessons(plan);

    expect(planned.filter((id) => id.startsWith("portfolio"))).toHaveLength(4);
    expect(planned.filter((id) => id.startsWith("job-search"))).toHaveLength(3);

    // Every module is in the plan with at least its core (a third), the depth where time allows.
    expect(plan.waitingSkillIds).toStrictEqual([]);

    expect(
      ["research", "design", "testing"].map(
        (skillId) => planned.filter((id) => id.startsWith(skillId)).length >= 3,
      ),
    ).toStrictEqual([true, true, true]);

    expect(planned.filter((id) => id.startsWith("testing")).length).toBeLessThan(8);

    expect(
      plan.items.every((item) => (item.scheduledFor ?? TODAY) < fromIsoDate("2026-10-12")),
    ).toBe(true);

    expect(plan.droppedSkillIds).not.toContain("portfolio");
    expect(plan.droppedSkillIds).not.toContain("job-search");

    const feasibility = getPlanFeasibility({ input });

    expect(feasibility.fits).toBe(false);
    expect(feasibility.coveredShare).toBeLessThan(1);
    expect(feasibility.recommendedMinutes).toBeGreaterThan(12);
  });

  it("plans everything in teaching order when the time covers it", () => {
    const plan = buildPlan(careerInput(60));

    expect(plannedLessons(plan)).toHaveLength(31);
    expect(plan.droppedSkillIds).toStrictEqual([]);
  });

  it("dates each phase by its main work, its challenge at its end, the depth after it in the last", () => {
    const plan = buildPlan(careerInput(16));
    const bosses = plan.items.filter((item) => item.kind === "boss");

    // Every phase keeps its challenge, the last one too: it closes what the plan's time fits.
    expect(bosses.map((item) => item.phase)).toStrictEqual([0, 1, 2, 3]);

    // A phase ends with its challenge; the last runs to the plan's end.
    expect(plan.phases.map((phase) => phase.endDate)).toStrictEqual([
      ...bosses.slice(0, -1).map((item) => dateOf(item)),
      dateOf(plan.items.at(-1) ?? { scheduledFor: null }),
    ]);

    // The depth studied once every core is in belongs to the time it's due in, not to its first
    // phase: each phase's work falls between its dates.
    expect(plan.items.find((item) => item.lessonId === "research-3")?.phase).toBe(3);

    expect(
      plan.items.filter((item) => {
        const phase = plan.phases[item.phase];
        const date = dateOf(item);

        return (
          !phase?.startDate || !phase.endDate || date < phase.startDate || date > phase.endDate
        );
      }),
    ).toStrictEqual([]);

    expect(findPhaseOverlaps(plan.phases)).toStrictEqual([]);
  });
});

/** The plan as stored: each item with its id (its key) and position. */
function store(
  plan: ReturnType<typeof buildPlan>,
  done: ReadonlySet<string> = new Set(),
): (ExistingPlanItem & { key: string })[] {
  return plan.items.map((item, position) => ({
    ...item,
    id: item.id ?? item.key,
    position,
    status: done.has(item.key) ? "done" : item.status,
  }));
}

function lessonsOn(plan: { items: readonly PlannedItem[] }, date: Date) {
  return plan.items
    .filter((item) => item.kind === "lesson" && item.scheduledFor?.getTime() === date.getTime())
    .map((item) => item.key);
}

function todoLessons(plan: { items: readonly Pick<PlannedItem, "key" | "kind" | "status">[] }) {
  return plan.items
    .filter((item) => item.kind === "lesson" && item.status === "todo")
    .map((item) => item.key)
    .toSorted();
}

describe("work an earlier day left", () => {
  const monday = fromIsoDate("2026-09-28");
  const tuesday = fromIsoDate("2026-09-29");
  const wednesday = fromIsoDate("2026-09-30");

  /** An exam with three subjects in a study cycle, 30 minutes a day, every day. */
  function cycleInput(attrs: Partial<BuildPlanInput> = {}): BuildPlanInput {
    const skills = [
      skill("math", { area: "Math", lessons: 30, weight: 5 }),
      skill("law", { area: "Law", lessons: 30, weight: 3 }),
      skill("reading", { area: "Portuguese", lessons: 30, weight: 1 }),
    ];

    return planInput({
      goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-12-20") },
      graph: { phases: [{ milestone: null, name: "Everything" }], skills },
      lessons: skills.flatMap((item) => lessonsFor(item.skillId, 30)),
      settings: parsePlanSettings({ startDate: "2026-09-28" }),
      today: monday,
      ...attrs,
    });
  }

  it("starts the next day with what the day before left, in plan order, at the day's size", () => {
    const first = buildPlan(cycleInput());
    const mondayLessons = lessonsOn(first, monday);
    const done = new Set(mondayLessons.slice(0, 2));
    const left = mondayLessons.slice(2);
    const items = store(first, done);

    const next = buildPlan(
      cycleInput({ carryOver: { lessonIds: [] }, items, mode: "forced", today: tuesday }),
    );

    const tuesdayLessons = lessonsOn(next, tuesday);

    expect(left.length).toBeGreaterThan(0);
    expect(tuesdayLessons.slice(0, left.length)).toStrictEqual(left);
    // The day keeps its size: what's carried takes the place of the day's own first lessons.
    expect(tuesdayLessons.length).toBeLessThanOrEqual(mondayLessons.length + 1);
    // Nothing is skipped.
    expect(todoLessons(next)).toStrictEqual(todoLessons({ items }));
  });

  it("carries two missed days, the oldest first", () => {
    const first = buildPlan(cycleInput());
    const items = store(first);
    const missed = [...lessonsOn(first, monday), ...lessonsOn(first, tuesday)];

    const next = buildPlan(
      cycleInput({ carryOver: { lessonIds: [] }, items, mode: "forced", today: wednesday }),
    );

    const carried = next.items
      .filter((item) => item.kind === "lesson")
      .slice(0, missed.length)
      .map((item) => item.key);

    expect(carried).toStrictEqual(missed);
    expect(todoLessons(next)).toStrictEqual(todoLessons({ items }));
  });

  it("brings the lessons the learner was given the day before first, even ones due later", () => {
    const first = buildPlan(cycleInput());
    const later = lessonsOn(first, fromIsoDate("2026-10-08"))[0] ?? "";
    const lessonId = later.replace("lesson:", "");

    const next = buildPlan(
      cycleInput({
        carryOver: { lessonIds: [lessonId] },
        // Monday was studied in full, but the day's session also gave this later lesson.
        items: store(first, new Set(lessonsOn(first, monday))),
        mode: "forced",
        today: tuesday,
      }),
    );

    expect(lessonsOn(next, tuesday)[0]).toBe(later);

    expect(todoLessons(next)).toStrictEqual(
      todoLessons({ items: store(first, new Set(lessonsOn(first, monday))) }),
    );
  });

  it("leaves days already past alone on automatic runs, for the next day's settling", () => {
    const first = buildPlan(cycleInput());
    const items = store(first);

    const next = buildPlan(cycleInput({ items, mode: "automatic", today: tuesday }));

    expect(lessonsOn(next, monday)).toStrictEqual(lessonsOn(first, monday));
  });
});
