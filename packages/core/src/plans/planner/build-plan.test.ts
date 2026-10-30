import { describe, expect, it } from "vitest";
import { findCurrentPhase, getPhaseStates, isPhaseFinished } from "../_utils/phase-states";
import { isPlanFinished } from "../_utils/plan-end";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { getShownPhaseEnds } from "./kept-phase-ends";
import { addDays, daysBetween, fromIsoDate, toIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { type ExistingPlanItem, type PlannedItem } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { DEFAULT_LESSON_MINUTES, type PlannerLesson } from "./plan-units";

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
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
    ...attrs,
  };
}

function summarize(plan: Pick<ReturnType<typeof buildPlan>, "items">) {
  return plan.items.map((item) => ({
    date: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
    key: item.key,
    phase: item.phase,
  }));
}

describe(buildPlan, () => {
  it("lays lessons, placeholders and phase checkpoints on days at the learner's time", () => {
    const plan = buildPlan(planInput());

    expect(summarize(plan)).toStrictEqual([
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
        minutes: 31,
        name: "Basics",
        startDate: "2026-09-28",
      },
      {
        endDate: "2026-10-02",
        kind: "learn",
        milestone: null,
        minutes: 21,
        name: "Advanced",
        startDate: "2026-10-01",
      },
    ]);

    expect(plan.estimate).toStrictEqual({
      endDate: fromIsoDate("2026-10-02"),
      remainingMinutes: 52,
      totalMinutes: 52,
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

  it("puts nothing more on a day the learner already studied, pinned to a Sunday", () => {
    const sunday = fromIsoDate("2026-10-11");
    const lessons = Array.from({ length: 30 }, (_, index) => lesson(`l${index}`, ["s1"]));

    const studied = existing({
      completedAt: sunday,
      id: "studied",
      lessonId: "l0",
      scheduledFor: sunday,
      skillId: "s1",
      status: "done",
    });

    const plan = buildPlan(
      planInput({
        items: [studied],
        lessons,
        mode: "automatic",
        settings: parsePlanSettings({ startDate: "2026-09-28" }),
        today: sunday,
      }),
    );

    const onSunday = plan.items.filter(
      (item) => item.scheduledFor && toIsoDate(item.scheduledFor) === "2026-10-11",
    );

    expect(onSunday.map(({ key, status }) => [key, status])).toStrictEqual([["lesson:l0", "done"]]);

    expect(
      toIsoDate(plan.items.find((item) => item.status === "todo")?.scheduledFor ?? sunday),
    ).toBe("2026-10-12");
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

  it("keeps practice days after the lessons of a stand-in this week begins", () => {
    const input = planInput({
      goal: { dailyMinutes: 12, kind: "learn", targetDate: fromIsoDate("2026-10-28") },
      graph: {
        phases: [{ milestone: null, name: "Only" }],
        skills: [skill("s1", { lessons: 60 })],
      },
      lessons: [],
    });

    const first = buildPlan(input);
    const next = buildPlan({ ...input, items: store(first), mode: "automatic" });

    expect(next.items.map((item) => [item.key, dateOf(item)])).toStrictEqual(
      first.items.map((item) => [item.key, dateOf(item)]),
    );
  });

  it("keeps a plan short on time as it was made on the first automatic run", () => {
    const input = planInput({
      goal: { dailyMinutes: 10, kind: "learn", targetDate: addDays(TODAY, 10) },
      graph: {
        phases: [
          { milestone: null, name: "First" },
          { milestone: null, name: "Second" },
          { milestone: null, name: "Third" },
        ],
        skills: [
          skill("s1", { lessons: 4 }),
          skill("s2", { lessons: 4, phase: 1 }),
          skill("s3", { lessons: 4, phase: 2 }),
        ],
      },
      lessons: [...lessonsFor("s1", 4), ...lessonsFor("s2", 4), ...lessonsFor("s3", 4)],
    });

    const first = buildPlan(input);
    const items = store(first);

    const next = buildPlan({
      ...input,
      items,
      mode: "automatic",
      phaseEnds: getShownPhaseEnds({ items, phases: first.phases }),
    });

    expect(next.items.map((item) => [item.key, dateOf(item)])).toStrictEqual(
      first.items.map((item) => [item.key, dateOf(item)]),
    );
  });

  it("keeps every skill the plan just made holds when the next run keeps this week", () => {
    const today = addDays(TODAY, 1);

    const input = planInput({
      goal: { dailyMinutes: 30, kind: "learn", targetDate: addDays(today, 7) },
      graph: {
        phases: ["First", "Second", "Third", "Fourth"].map((name) => ({ milestone: null, name })),
        skills: Array.from({ length: 12 }, (_, index) =>
          skill(`s${index}`, { lessons: 1, phase: Math.floor(index / 3) }),
        ),
      },
      lessons: Array.from({ length: 12 }, (_, index) => lessonsFor(`s${index}`, 4)).flat(),
      today,
    });

    const short = buildPlan({ ...input, goal: { ...input.goal, dailyMinutes: 10 } });

    const studied = store(short).map((item) =>
      item.kind === "lesson" ? { ...item, completedAt: today, status: "done" as const } : item,
    );

    const finishedOn = new Map(
      studied.flatMap((item) => (item.status === "done" ? [[item.id, today] as const] : [])),
    );

    const first = buildPlan({ ...input, finishedOn, items: studied });
    const items = store(first);

    const next = buildPlan({
      ...input,
      finishedOn,
      items,
      mode: "automatic",
      phaseEnds: getShownPhaseEnds({ items, phases: first.phases }),
    });

    expect(skillsOf(next.items)).toStrictEqual(skillsOf(first.items));
  });

  it("keeps the end the learner saw of a phase whose challenge they won early", () => {
    const input = planInput({
      graph: {
        phases: [
          { milestone: null, name: "First" },
          { milestone: null, name: "Second" },
          { milestone: null, name: "Third" },
        ],
        skills: [
          skill("s1", { lessons: 4 }),
          skill("s2", { lessons: 6, phase: 1 }),
          skill("s3", { lessons: 4, phase: 2 }),
        ],
      },
      lessons: [...lessonsFor("s1", 4), ...lessonsFor("s2", 6), ...lessonsFor("s3", 4)],
    });

    const first = buildPlan(input);
    const today = addDays(TODAY, 1);

    const items = store(first, new Set(["boss:1", ...lessonsOn(first, TODAY)])).map((item) =>
      item.status === "done" ? { ...item, completedAt: today } : item,
    );

    const phaseEnds = getShownPhaseEnds({ items, phases: first.phases });

    const keptAfter = (mode: BuildPlanInput["mode"]) => {
      const next = buildPlan({ ...input, items, mode, phaseEnds, today });

      return {
        ends: next.phases.slice(0, -1).map((phase) => phase.endDate),
        phases: next.items.filter((item) => item.skillId === "s2").map((item) => item.phase),
      };
    };

    const kept = {
      ends: first.phases.slice(0, -1).map((phase) => phase.endDate),
      phases: [1, 1, 1, 1, 1, 1],
    };

    expect(keptAfter("automatic")).toStrictEqual(kept);
    expect(keptAfter("forced")).toStrictEqual(kept);
  });

  it("keeps the chapter an unstarted skill's item teaches from when it moves after this week", () => {
    const items = [
      existing({
        chapterId: "c2",
        id: "next-week",
        scheduledFor: fromIsoDate("2026-10-06"),
        skillId: "s2",
      }),
    ];

    const moved = (mode: BuildPlanInput["mode"]) =>
      buildPlan(planInput({ items, mode })).items.find((item) => item.id === "next-week");

    expect(moved("automatic")).toMatchObject({ chapterId: "c2", key: "skill:s2" });
    expect(moved("forced")).toMatchObject({ chapterId: "c2", key: "skill:s2" });
  });

  it("finishes the chapter the learner is in before anything a change moves ahead, short on time too", () => {
    const started = Array.from({ length: 7 }, (_, index) => ({
      ...lesson(`cognition-${index}`, ["s1"]),
      chapterId: "cognition",
    }));

    const items = started.map((row, index) =>
      existing({
        chapterId: "cognition",
        completedAt: index < 3 ? new Date(TODAY.getTime() + index) : null,
        id: row.lessonId,
        lessonId: row.lessonId,
        position: index,
        scheduledFor: TODAY,
        skillId: "s1",
        status: index < 3 ? "done" : "todo",
      }),
    );

    const plan = buildPlan(
      planInput({
        goal: { dailyMinutes: 12, kind: "learn", targetDate: addDays(TODAY, 20) },
        graph: {
          phases: [{ milestone: null, name: "Basics" }],
          skills: [
            skill("s1", { area: "Basics" }),
            skill("s2", { area: "Research", lessons: 30 }),
            skill("s3", { area: "Basics", lessons: 30 }),
          ],
        },
        items,
        lessons: started,
        mode: "forced",
        settings: parsePlanSettings({ focusAreas: ["Research"] }),
      }),
    );

    const next = plan.items.filter((item) => item.kind === "lesson" && item.status === "todo");

    expect(next.slice(0, 4).map((item) => item.key)).toStrictEqual([
      "lesson:cognition-3",
      "lesson:cognition-4",
      "lesson:cognition-5",
      "lesson:cognition-6",
    ]);
  });

  it("keeps the lessons of the chapter in progress the learner saw when a change is short on time", () => {
    const lessons = Array.from({ length: 9 }, (_, index) => ({
      ...lesson(`o${index + 1}`, ["s1"]),
      chapterId: "organelles",
    }));

    const items = [...lessons.slice(0, 3), ...lessons.slice(7)].map((row, index) =>
      existing({
        chapterId: "organelles",
        completedAt: index < 3 ? addDays(TODAY, -1) : null,
        id: row.lessonId,
        lessonId: row.lessonId,
        position: index,
        scheduledFor: addDays(TODAY, index < 3 ? -1 : index - 3),
        skillId: "s1",
        status: index < 3 ? "done" : "todo",
      }),
    );

    const plan = buildPlan(
      planInput({
        goal: { dailyMinutes: 6, kind: "learn", targetDate: addDays(TODAY, 2) },
        graph: {
          phases: [{ milestone: null, name: "Cells" }],
          skills: [skill("s1", { lessons: 9 })],
        },
        items,
        lessons,
        settings: parsePlanSettings({ startDate: toIsoDate(addDays(TODAY, -1)) }),
      }),
    );

    const todo = plan.items.filter((item) => item.kind === "lesson" && item.status === "todo");

    expect(todo.map((item) => item.key)).toStrictEqual(["lesson:o8", "lesson:o9"]);
  });

  it("leaves a lesson of the chapter in progress after what its own skill builds on", () => {
    const apartment = [
      { ...lesson("rent-1", ["rent"]), chapterId: "apartment" },
      { ...lesson("visit-1", ["visit"]), chapterId: "apartment" },
    ];

    const items = [
      existing({
        chapterId: "apartment",
        completedAt: addDays(TODAY, -1),
        id: "rent-1",
        lessonId: "rent-1",
        scheduledFor: addDays(TODAY, -1),
        skillId: "rent",
        status: "done",
      }),
      existing({
        chapterId: "apartment",
        id: "visit-1",
        lessonId: "visit-1",
        position: 2,
        scheduledFor: addDays(TODAY, 3),
        skillId: "visit",
      }),
    ];

    const plan = buildPlan(
      planInput({
        graph: {
          phases: [{ milestone: null, name: "Housing" }],
          skills: [skill("rent", { lessons: 1 }), skill("ask"), skill("visit", { lessons: 1 })],
        },
        items,
        lessons: apartment,
        prerequisites: new Map([["visit", ["ask"]]]),
      }),
    );

    const keys = plan.items.filter((item) => item.status === "todo").map((item) => item.key);

    expect(keys.indexOf("skill:ask")).toBeLessThan(keys.indexOf("lesson:visit-1"));
  });

  it("keeps a later phase's chapter in progress in its phase, each phase closed once", () => {
    const advanced = ["a1", "a2", "a3"].map((id) => ({ ...lesson(id, ["s3"]), chapterId: "adv" }));

    const items = advanced.map((row, index) =>
      existing({
        chapterId: "adv",
        completedAt: index === 0 ? TODAY : null,
        id: row.lessonId,
        lessonId: row.lessonId,
        phase: 1,
        position: index,
        scheduledFor: TODAY,
        skillId: "s3",
        status: index === 0 ? "done" : "todo",
      }),
    );

    const plan = buildPlan(
      planInput({
        graph: {
          phases: [
            { milestone: null, name: "Basics" },
            { milestone: null, name: "Advanced" },
          ],
          skills: [skill("s1"), skill("s3", { phase: 1 }), skill("s4", { phase: 1 })],
        },
        items,
        lessons: [lesson("l1", ["s1"]), lesson("l2", ["s1"]), ...advanced],
      }),
    );

    const keys = plan.items.filter((item) => item.status === "todo").map((item) => item.key);

    expect(keys).toStrictEqual([
      "lesson:l1",
      "lesson:l2",
      "boss:0",
      "lesson:a2",
      "lesson:a3",
      "skill:s4",
      "boss:1",
    ]);
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
      summarize(buildPlan(planInput({ graph, lessons: [], settings }))).map((item) => item.key),
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
      mockMinutes: 45,
      prerequisites: new Map([["s3", ["s2"]]]),
      settings: parsePlanSettings({
        startDate: "2026-09-23",
        weekdayMinutes: [0, 45, 45, 45, 45, 45, 45],
      }),
      today: examStart,
      ...attrs,
    });
  }

  it("orders skills by priority and keeps prerequisites first", () => {
    const plan = buildPlan(examInput());
    const lessons = plan.items.filter((item) => item.kind === "lesson");

    expect(lessons.map((item) => item.skillId)).toStrictEqual(["s1", "s2", "s3"]);
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

  it("keeps this week's lesson in the final stretch at the minutes it was given", () => {
    const day = fromIsoDate("2026-11-02");

    const plan = buildPlan(
      examInput({
        items: [existing({ id: "late", lessonId: "l1", phase: 3, scheduledFor: day })],
        lessons: [lesson("l1", ["s1"])],
        mode: "automatic",
        today: day,
      }),
    );

    expect(plan.items.find((item) => item.id === "late")).toMatchObject({
      minutes: 3,
      scheduledFor: day,
    });
  });

  function datesOf({ kind, plan }: { kind: string; plan: ReturnType<typeof buildPlan> }) {
    return plan.items
      .filter((item) => item.kind === kind)
      .map((item) => toIsoDate(item.scheduledFor ?? examStart));
  }

  it("plans weekly mocks from the second week in every phase, review days at the end and a light day before", () => {
    const lessons = Array.from({ length: 400 }, (_, index) => lesson(`l${index}`, ["s1"]));
    const plan = buildPlan(examInput({ lessons }));

    expect(datesOf({ kind: "mock", plan })).toStrictEqual([
      "2026-10-03",
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

    expect(datesOf({ kind: "boss", plan })).toStrictEqual([
      "2026-10-05",
      "2026-10-21",
      "2026-11-02",
    ]);
  });

  it("gives an exam without a date weekly mocks from its second week, in place of checkpoints", () => {
    const lessons = Array.from({ length: 150 }, (_, index) => lesson(`l${index}`, ["s1"]));

    const plan = buildPlan(
      examInput({ goal: { dailyMinutes: 45, kind: "exam", targetDate: null }, lessons }),
    );

    const mocks = plan.items.filter((item) => item.kind === "mock");

    expect(datesOf({ kind: "checkpoint", plan })).toStrictEqual([]);
    expect(datesOf({ kind: "mock", plan }).slice(0, 2)).toStrictEqual(["2026-10-03", "2026-10-10"]);

    expect(mocks.every((item) => item.scheduledFor?.getUTCDay() === 6 && item.minutes === 45)).toBe(
      true,
    );
  });

  it("keeps the weekly mock days away from the exam when the learner's last study day is near it", () => {
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
    const plan = buildPlan(
      examInput({
        goal: { dailyMinutes: 45, kind: "exam", targetDate: fromIsoDate("2026-12-20") },
      }),
    );

    const mocks = datesOf({ kind: "mock", plan });
    const finalStretch = plan.phases.find((phase) => phase.kind === "finalStretch");
    const inFinalStretch = mocks.filter((date) => date >= (finalStretch?.startDate ?? ""));

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

    const covered = new Map(
      built.skillMinutes.map((entry) => [entry.skillId, entry.covered / entry.total]),
    );

    expect(built.waitingSkillIds).toStrictEqual([]);
    expect(covered.get("s0")).toBeGreaterThan(covered.get("s1") ?? 1);
    expect(feasibility.coveredShare).toBeGreaterThan(0);
    expect(feasibility.coveredShare).toBeLessThan(1);
    expect(feasibility.recommendedMinutes).toBeGreaterThan(40);

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

  it("starts the next phase on its checkpoint's day, after the checkpoint", () => {
    const plan = buildPlan(
      planInput({ goal: { dailyMinutes: 30, kind: "learn", targetDate: null } }),
    );

    expect(summarize(plan)).toStrictEqual([
      { date: "2026-09-28", key: "lesson:l1", phase: 0 },
      { date: "2026-09-28", key: "lesson:l2", phase: 0 },
      { date: "2026-09-28", key: "skill:s2", phase: 0 },
      { date: "2026-09-29", key: "boss:0", phase: 0 },
      { date: "2026-09-29", key: "lesson:l3", phase: 1 },
      { date: "2026-09-30", key: "boss:1", phase: 1 },
    ]);

    expect(findPhaseOverlaps(plan.phases)).toStrictEqual([]);
  });

  it("starts the first phase and its first stand-in when the plan starts, though it takes days", () => {
    const plan = buildPlan(
      planInput({
        graph: { phases: twoPhases, skills: [skill("s1", { lessons: 6 })] },
        lessons: [],
      }),
    );

    expect(plan.phases[0]?.startDate).toBe("2026-09-28");

    expect(plan.items.find((item) => item.kind === "lesson")?.scheduledFor).toStrictEqual(
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

    expect(standIns(plan)).toStrictEqual([["s2", 6]]);

    expect(plan.items.find((item) => item.key === "skill:s2")?.minutes).toBe(48);

    expect(
      plan.items.filter((item) => item.kind === "boss").map((item) => item.minutes),
    ).toStrictEqual([15, 15]);

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
    const input = languageInput({
      settings: parsePlanSettings({ startDate: toIsoDate(addDays(TODAY, -1)) }),
    });

    const keys = buildPlan(input).items.map((item) => item.key);

    expect(keys.filter((key) => key.startsWith("skill:"))).toStrictEqual([
      "skill:greet",
      "skill:introduce",
      "skill:interview",
    ]);

    expect(keys.indexOf("skill:greet")).toBe(keys.indexOf("lesson:arrival-5") + 1);

    const outlined = (6 + 5) * 3;
    const standInMinutes = (15 + 17 + 25) * DEFAULT_LESSON_MINUTES;
    expect(lessonMinutes(input)).toBeCloseTo((outlined + standInMinutes) / 0.5);
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

    expect(lastLesson.getTime()).toBeLessThan(fromIsoDate("2026-11-30").getTime());
    expect(end.getTime()).toBeGreaterThan(fromIsoDate("2026-12-27").getTime());
    expect(end.getTime()).toBeLessThan(interview.getTime());
    expect(getPlanFeasibility({ input }).endDate?.getTime()).toBe(end.getTime());

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

function standIns(plan: ReturnType<typeof buildPlan>) {
  return plan.items
    .filter((item) => item.kind === "lesson" && !item.lessonId)
    .map((item) => [item.skillId, Math.round((item.minutes * 0.5) / DEFAULT_LESSON_MINUTES)]);
}

describe("studying everything", () => {
  const EXAM_DAY = "2026-10-23";

  const dated = planInput({
    goal: { dailyMinutes: 40, kind: "exam", targetDate: fromIsoDate(EXAM_DAY) },
    graph: {
      phases: [{ milestone: null, name: "Everything" }],
      skills: Array.from({ length: 6 }, (_, index) =>
        skill(`s${index}`, { lessons: 40, weight: index === 0 ? 5 : 1 }),
      ),
    },
    lessons: ["s0", "s1", "s2"].flatMap((skillId) => lessonsFor(skillId, 40)),
    settings: parsePlanSettings({ startDate: "2026-09-28" }),
  });

  const studyingEverything = { ...dated, settings: { ...dated.settings, fullCourse: true } };

  it("keeps an exam plan as its date shapes it until the exam, and studies the rest after it", () => {
    const byExam = buildPlan(dated);
    const plan = buildPlan(studyingEverything);
    const after = plan.items.filter((item) => toIsoDate(item.scheduledFor ?? TODAY) > EXAM_DAY);

    const teachingBeforeExam = (built: typeof plan) =>
      [...built.lessonDayMinutes]
        .map(([key, days]) => ({
          key,
          portions: [...days]
            .filter(([date]) => date <= EXAM_DAY)
            .toSorted(([first], [second]) => first.localeCompare(second)),
        }))
        .filter(({ portions }) => portions.length > 0)
        .toSorted((first, second) => first.key.localeCompare(second.key));

    const lessonDatesBeforeExam = (built: typeof plan) =>
      built.items
        .filter(
          (item) =>
            item.kind === "lesson" &&
            item.scheduledFor !== null &&
            toIsoDate(item.scheduledFor) <= EXAM_DAY,
        )
        .map((item) => [item.key, toIsoDate(item.scheduledFor!)]);

    expect(lessonDatesBeforeExam(plan)).toStrictEqual(lessonDatesBeforeExam(byExam));

    const eventsBeforeExam = (built: typeof plan) =>
      built.items
        .filter(
          (item) =>
            item.kind !== "lesson" &&
            item.scheduledFor !== null &&
            toIsoDate(item.scheduledFor) <= EXAM_DAY,
        )
        .map((item) => [item.key, toIsoDate(item.scheduledFor!), item.minutes]);

    expect(eventsBeforeExam(plan)).toStrictEqual(eventsBeforeExam(byExam));

    expect(teachingBeforeExam(plan)).toStrictEqual(teachingBeforeExam(byExam));

    expect(
      plan.items
        .filter((item) => item.kind === "boss")
        .map((item) => [item.key, item.phase, toIsoDate(item.scheduledFor!)]),
    ).toStrictEqual(
      byExam.items
        .filter((item) => item.kind === "boss")
        .map((item) => [item.key, item.phase, toIsoDate(item.scheduledFor!)]),
    );

    expect(byExam.droppedSkillIds.length).toBeGreaterThan(0);
    expect(plan.droppedSkillIds).toStrictEqual([]);

    const mocks = after.filter((item) => item.kind === "mock");

    expect(after.some((item) => item.kind === "lesson")).toBe(true);
    expect(mocks.length).toBeGreaterThan(0);
    expect(toIsoDate(mocks[0]?.scheduledFor ?? TODAY) >= "2026-10-31").toBe(true);
    expect(mocks.every((item) => item.minutes === 150)).toBe(true);
    expect(after.some((item) => item.kind === "review" || item.kind === "checkpoint")).toBe(false);

    expect(after.filter((item) => item.kind !== "boss").every((item) => item.phase === 4)).toBe(
      true,
    );

    expect(plan.phases.map((phase) => phase.kind)).toStrictEqual([
      "foundations",
      "gaps",
      "practice",
      "finalStretch",
      "afterExam",
    ]);

    expect(plan.phases.at(-1)).toMatchObject({ kind: "afterExam", startDate: "2026-10-24" });
    expect(toIsoDate(plan.estimate.endDate ?? TODAY)).toBe(plan.phases.at(-1)?.endDate);
  });

  it("goes on with what's left once the exam is past", () => {
    const plan = buildPlan({ ...studyingEverything, today: fromIsoDate("2026-10-26") });
    const lessons = plan.items.filter((item) => item.kind === "lesson");

    const afterToday = lessons.every(
      (item) => toIsoDate(item.scheduledFor ?? TODAY) >= "2026-10-26",
    );

    expect(lessons.length).toBeGreaterThan(0);
    expect(afterToday).toBe(true);

    expect(plan.phases.at(-1)?.kind).toBe("afterExam");
  });

  it("measures what fits by the exam either way, and says when everything would end", () => {
    const byExam = getPlanFeasibility({ input: dated });
    const feasibility = getPlanFeasibility({ input: studyingEverything });

    expect(feasibility).toMatchObject({
      coreFits: byExam.coreFits,
      fits: false,
      recommendedMinutes: byExam.recommendedMinutes,
    });

    expect(feasibility.coveredShare).toBeCloseTo(byExam.coveredShare, 2);

    expect(byExam.fullCourseEndDate?.getTime()).toBeGreaterThan(fromIsoDate(EXAM_DAY).getTime());
    expect(feasibility.fullCourseEndDate).toStrictEqual(byExam.fullCourseEndDate);
    expect(feasibility.endDate).toStrictEqual(byExam.fullCourseEndDate);
  }, 45_000);

  it("says when a goal with a date would end without one, and nothing once it all fits", () => {
    const career = planInput({
      goal: { dailyMinutes: 15, kind: "learn", targetDate: fromIsoDate("2026-10-12") },
      graph: {
        phases: [{ milestone: null, name: "Everything" }],
        skills: [skill("s1", { lessons: 40 })],
      },
    });

    const noDate = getPlanFeasibility({
      input: { ...career, goal: { ...career.goal, targetDate: null } },
    });

    expect(getPlanFeasibility({ input: career }).fullCourseEndDate).toStrictEqual(noDate.endDate);
    expect(getPlanFeasibility({ input: planInput() }).fullCourseEndDate).toBeNull();
  });
});

describe("big goals of any kind", () => {
  it("sizes a big learn skill from the graph, and a skill a few lessons short from its outline", () => {
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
        lessons: [...lessonsFor("waves", 10), ...lessonsFor("spin", 6), ...lessonsFor("units", 5)],
      }),
    );

    expect(standIns(plan)).toStrictEqual([
      ["waves", 20],
      ["spin", 34],
    ]);

    const keys = plan.items.map((item) => item.key);
    expect(keys.indexOf("skill:waves")).toBe(keys.indexOf("lesson:waves-9") + 1);
  });

  it("puts a dated exam plan's stand-ins after their skill's lessons, before the final stretch, and says what doesn't fit", () => {
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

    const smallerGraph = {
      ...input,
      graph: { ...input.graph, skills: skills.map((item) => ({ ...item, lessons: 5 })) },
    };

    expect(getPlanFeasibility({ input: smallerGraph }).fits).toBe(true);
  });
});

describe("a phase whose lessons the learner's time leaves out", () => {
  const phases = ["Basics", "Known", "Later"].map((name) => ({ milestone: null, name }));

  const input = planInput({
    goal: { dailyMinutes: 5, kind: "learn", targetDate: fromIsoDate("2026-10-02") },
    graph: {
      phases,
      skills: [
        skill("a", { lessons: 4 }),
        skill("b", { lessons: 20, phase: 1 }),
        skill("c", { lessons: 20, phase: 2 }),
      ],
    },
    items: [0, 1].map((index) =>
      existing({
        id: `known-${index}`,
        lessonId: `known-${index}`,
        phase: 1,
        position: index,
        scheduledFor: TODAY,
        skillId: "b",
        status: "testedOut",
      }),
    ),
    lessons: lessonsFor("a", 4),
  });

  it("has no challenge, even beside lessons placement found known today", () => {
    const plan = buildPlan(input);

    const taught = (phase: number) =>
      plan.items.some(
        (item) => item.kind === "lesson" && item.phase === phase && item.status === "todo",
      );

    const bosses = plan.items.filter((item) => item.kind === "boss");

    expect(taught(2)).toBe(false);
    expect(bosses.map((boss) => boss.phase)).toStrictEqual([0]);
    expect(isPhaseFinished(plan.items.filter((item) => item.phase === 1))).toBe(true);

    expect(plan.phases.map((phase) => phase.challengeLeftOut ?? false)).toStrictEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("a phase its time covers in part", () => {
  const input = planInput({
    goal: { dailyMinutes: 5, kind: "learn", targetDate: fromIsoDate("2026-10-02") },
    graph: {
      phases: ["Known", "Middle", "Cut"].map((name) => ({ milestone: null, name })),
      skills: [
        skill("k", { lessons: 2 }),
        skill("m", { lessons: 20, phase: 1 }),
        skill("c", { lessons: 20, phase: 2 }),
      ],
    },
    items: [0, 1].map((index) =>
      existing({
        id: `known-${index}`,
        lessonId: `k-${index}`,
        position: index,
        scheduledFor: TODAY,
        skillId: "k",
        status: "testedOut",
      }),
    ),
    lessons: [...lessonsFor("k", 2), ...lessonsFor("m", 20), ...lessonsFor("c", 20)],
  });

  it("leaves its challenge out, so finishing the lessons it holds finishes neither it nor the plan", () => {
    const plan = buildPlan(input);

    const studied = plan.items.map((item) =>
      item.kind === "lesson" && item.status === "todo"
        ? { ...item, status: "done" as const }
        : item,
    );

    const end = {
      goalKind: "learn" as const,
      items: studied,
      phases: plan.phases,
      targetDate: input.goal.targetDate,
      today: TODAY,
    };

    expect(studied.some((item) => item.kind === "lesson" && item.phase === 1)).toBe(true);
    expect(studied.some((item) => item.kind === "boss")).toBe(false);

    expect(plan.phases.map((phase) => phase.challengeLeftOut ?? false)).toStrictEqual([
      false,
      true,
      false,
    ]);

    expect(
      getPhaseStates({
        ...end,
        currentPhase: findCurrentPhase({ items: studied, phaseCount: plan.phases.length }),
      }),
    ).toStrictEqual(["done", "unfinished", "leftOut"]);

    expect(isPlanFinished(end)).toBe(false);
  });

  it("gets its challenge back once the learner gives the plan the time", () => {
    const tight = buildPlan(input);
    const roomy = buildPlan({ ...input, goal: { ...input.goal, dailyMinutes: 60 } });

    expect(tight.phases[1]?.challengeLeftOut).toBe(true);
    expect(roomy.phases[1]?.challengeLeftOut).toBeUndefined();
    expect(roomy.items.some((item) => item.kind === "boss" && item.phase === 1)).toBe(true);
  });
});

describe("phase challenges on a day the learner's time fills", () => {
  const input = planInput({
    goal: { dailyMinutes: 15, kind: "learn", targetDate: addDays(TODAY, 1) },
    graph: {
      phases: ["One", "Two", "Three"].map((name) => ({ milestone: null, name })),
      skills: ["a", "b", "c"].map((skillId, phase) => skill(skillId, { lessons: 3, phase })),
    },
    lessons: ["a", "b", "c"].flatMap((skillId) => lessonsFor(skillId, 3)),
  });

  it("run the day past that time by one challenge at most, and leave the rest out", () => {
    const plan = buildPlan(input);
    const bosses = plan.items.filter((item) => item.kind === "boss");

    const taught = (phase: number) =>
      plan.items.some((item) => item.kind === "lesson" && item.phase === phase);

    const byDay = Map.groupBy(bosses, (boss) => toIsoDate(boss.scheduledFor ?? TODAY));

    expect([...byDay.values()].map((onDay) => onDay.length)).toStrictEqual([1]);

    expect(
      plan.phases.map(
        (phase, index) =>
          phase.challengeLeftOut === true || bosses.some((boss) => boss.phase === index),
      ),
    ).toStrictEqual([0, 1, 2].map((phase) => taught(phase)));
  });
});

describe("a plan's first day", () => {
  it("has study time even when the learner rests on that weekday, and rests from the next week on", () => {
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
    expect(lessonDays.has("2026-10-05")).toBe(false);
  });

  it("gives its lessons the learner's whole time, since there's nothing to review yet", () => {
    const lessons = Array.from({ length: 12 }, (_, index) => lesson(`l${index}`, ["s1"], 4));

    const plan = buildPlan(
      planInput({
        goal: { dailyMinutes: 16, kind: "learn", targetDate: null },
        graph: { phases: [{ milestone: null, name: "Basics" }], skills: [skill("s1")] },
        lessons,
        settings: parsePlanSettings({ startDate: "2026-09-28" }),
      }),
    );

    expect(lessonsOn(plan, TODAY)).toHaveLength(4);
    expect(lessonsOn(plan, addDays(TODAY, 1))).toHaveLength(2);
  });
});

const MORE_THAN_A_DAY_HOLDS = Array.from({ length: 40 }, (_, index) =>
  skill(`s${index}`, { lessons: 40 }),
);

describe("a plan no daily time can cover", () => {
  it("recommends no time when not even a whole day covers everything", () => {
    const input = planInput({
      goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-09-30") },
      graph: { phases: [{ milestone: null, name: "Everything" }], skills: MORE_THAN_A_DAY_HOLDS },
      settings: parsePlanSettings({ startDate: "2026-09-28" }),
    });

    const feasibility = getPlanFeasibility({ input });

    expect(feasibility).toMatchObject({ fits: false, recommendedMinutes: null });
    expect(feasibility.fittingDate).toBeNull();
  });

  it("names the earliest date the learner's own time covers everything by", () => {
    const input = planInput({
      goal: { dailyMinutes: 30, kind: "learn", targetDate: fromIsoDate("2026-09-30") },
      graph: { phases: [{ milestone: null, name: "Everything" }], skills: MORE_THAN_A_DAY_HOLDS },
      settings: parsePlanSettings({ startDate: "2026-09-28" }),
    });

    const { fittingDate, recommendedMinutes } = getPlanFeasibility({ input });

    const by = (targetDate: Date) =>
      getPlanFeasibility({ input: { ...input, goal: { ...input.goal, targetDate } } });

    expect(recommendedMinutes).toBeNull();
    expect(fittingDate).not.toBeNull();
    expect(by(fittingDate ?? TODAY).fits).toBe(true);
    expect(by(addDays(fittingDate ?? TODAY, -1)).fits).toBe(false);
  });
});

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

    expect(bosses.map((item) => item.phase)).toStrictEqual([0, 1, 2, 3]);

    expect(plan.phases.map((phase) => phase.endDate)).toStrictEqual([
      ...bosses.slice(0, -1).map((item) => dateOf(item)),
      dateOf(plan.items.at(-1) ?? { scheduledFor: null }),
    ]);

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

function skillsOf(planned: readonly PlannedItem[]): Set<string> {
  return new Set(
    planned.flatMap((item) => (item.kind === "lesson" && item.skillId ? [item.skillId] : [])),
  );
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

describe("a run after a session that went faster than planned", () => {
  it("keeps new lessons off a day with no time for lessons", () => {
    const today = fromIsoDate("2026-10-12");
    const testDay = fromIsoDate("2026-10-20");
    const lessons = [...lessonsFor("s1", 4), ...lessonsFor("s2", 4), ...lessonsFor("s3", 4)];

    const input = planInput({
      goal: { dailyMinutes: 20, kind: "exam", targetDate: testDay },
      graph: {
        phases: [{ milestone: null, name: "Everything" }],
        skills: [
          skill("s1", { lessons: 4, weight: 3 }),
          skill("s2", { lessons: 4, weight: 2 }),
          skill("s3", { lessons: 4, weight: 1 }),
        ],
      },
      lessons: lessons.map((entry) => ({ ...entry, minutes: 5 })),
      mockMinutes: 60,
      settings: parsePlanSettings({ startDate: "2026-10-12" }),
      today,
    });

    const next = buildPlan({
      ...input,
      items: store(buildPlan(input)),
      lessons: lessons.map((entry) => ({ ...entry, minutes: 2.5 })),
      mode: "automatic",
      paceFactor: 0.5,
    });

    expect(lessonsOn(next, addDays(testDay, -1))).toStrictEqual([]);
  });
});

describe("work an earlier day left", () => {
  const monday = fromIsoDate("2026-09-28");
  const tuesday = fromIsoDate("2026-09-29");
  const wednesday = fromIsoDate("2026-09-30");

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
    expect(tuesdayLessons.length).toBeLessThanOrEqual(mondayLessons.length + 1);
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

  it("keeps a shown phase end on its day when what the day before left fills it", () => {
    const input = planInput({
      goal: { dailyMinutes: 15, kind: "learn", targetDate: null },
      graph: {
        phases: [
          { milestone: null, name: "First" },
          { milestone: null, name: "Second" },
        ],
        skills: [skill("s1"), skill("s2", { lessons: 4, phase: 1 })],
      },
      lessons: [lesson("l1", ["s1"]), lesson("l2", ["s1"]), ...lessonsFor("s2", 4)],
      settings: parsePlanSettings({
        startDate: toIsoDate(monday),
        weekdayMinutes: [15, 15, 21, 15, 15, 15, 15],
      }),
    });

    const first = buildPlan(input);
    const given = lessonsOn(first, wednesday).slice(0, 2);
    const items = store(first, new Set(lessonsOn(first, monday)));

    const settledInput: BuildPlanInput = {
      ...input,
      carryOver: { lessonIds: given.map((key) => key.replace("lesson:", "")) },
      items,
      phaseEnds: new Map([[0, tuesday]]),
      today: tuesday,
    };

    const next = buildPlan(settledInput);

    const withoutRoom = buildPlan({
      ...settledInput,
      settings: { ...input.settings, weekdayMinutes: [15, 15, 15, 15, 15, 15, 15] },
    });

    const onTuesday = next.items.filter(
      (item) => item.scheduledFor?.getTime() === tuesday.getTime(),
    );

    expect(first.phases[0]?.endDate).toBe("2026-09-29");
    expect(first.items.find((item) => item.key === "boss:0")?.minutes).toBe(15);
    expect(given).toHaveLength(2);
    expect(lessonsOn(next, tuesday)[0]).toBe(given[0]);
    expect(next.phases[0]?.endDate).toBe("2026-09-29");
    expect(todoLessons(next)).toStrictEqual(todoLessons({ items }));

    expect(onTuesday.map((item) => [item.key, item.minutes])).toStrictEqual([
      [given[0], 6],
      ["boss:0", 15],
    ]);

    expect(onTuesday.reduce((minutes, item) => minutes + item.minutes, 0)).toBe(21);
    expect(lessonsOn(withoutRoom, tuesday)).toStrictEqual([]);
    expect(withoutRoom.phases[0]?.endDate).toBe("2026-09-29");
    expect(todoLessons(withoutRoom)).toStrictEqual(todoLessons({ items }));
  });

  it("leaves a lesson given ahead where its phase has it while an earlier phase has days of work left", () => {
    const input = planInput({
      graph: {
        phases: [
          { milestone: null, name: "First" },
          { milestone: null, name: "Second" },
          { milestone: null, name: "Third" },
        ],
        skills: [
          skill("s1", { lessons: 8 }),
          skill("s2", { lessons: 8, phase: 1 }),
          skill("s3", { lessons: 2, phase: 2 }),
        ],
      },
      lessons: [...lessonsFor("s1", 8), ...lessonsFor("s2", 8), ...lessonsFor("s3", 2)],
    });

    const first = buildPlan(input);
    const ahead = first.items.find((item) => item.key === "lesson:s3-0");

    const next = buildPlan({
      ...input,
      carryOver: { lessonIds: ["s3-0"] },
      items: store(first, new Set(lessonsOn(first, monday))),
      today: tuesday,
    });

    expect(ahead && dateOf(ahead) > "2026-09-30").toBe(true);
    expect(lessonsOn(next, tuesday)).not.toContain("lesson:s3-0");
    expect(findPhaseOverlaps(next.phases)).toStrictEqual([]);
  });

  it("lays the plan out as the day's settling did on a later run that day", () => {
    const input = planInput({
      goal: { dailyMinutes: 12, kind: "learn", targetDate: fromIsoDate("2026-10-16") },
      graph: {
        phases: [
          { milestone: null, name: "First" },
          { milestone: null, name: "Second" },
        ],
        skills: [skill("s1", { lessons: 6 }), skill("s2", { lessons: 12, phase: 1 })],
      },
      lessons: [lesson("l1", ["s1"]), lesson("l2", ["s1"]), ...lessonsFor("s2", 12)],
    });

    const first = buildPlan(input);
    const given = ["lesson:s2-0", "lesson:s2-1"];
    const items = store(first, new Set(lessonsOn(first, monday)));
    const carryOver = { lessonIds: given.map((key) => key.replace("lesson:", "")) };
    const phaseEnds = new Map([[0, tuesday]]);

    const settled = buildPlan({ ...input, carryOver, items, phaseEnds, today: tuesday });
    const saved = store(settled);
    const carried = saved.filter((item) => given.includes(item.key)).map((item) => item.id);

    const next = buildPlan({
      ...input,
      carryOver: { ...carryOver, itemIds: carried },
      items: saved,
      mode: "automatic",
      phaseEnds,
      today: tuesday,
    });

    expect(given).toHaveLength(2);

    expect(next.items.map((item) => [item.key, dateOf(item)])).toStrictEqual(
      settled.items.map((item) => [item.key, dateOf(item)]),
    );
  });

  it("sets aside work an earlier day left that no longer fits by the date, never deleting it", () => {
    const input = planInput({
      goal: { dailyMinutes: 12, kind: "learn", targetDate: fromIsoDate("2026-10-01") },
      graph: {
        phases: [{ milestone: null, name: "Only" }],
        skills: [skill("s1", { lessons: 4 }), skill("s2", { lessons: 4 })],
      },
      lessons: lessonsFor("s1", 4),
    });

    const first = buildPlan(input);
    const items = store(first);

    const next = buildPlan({
      ...input,
      carryOver: { lessonIds: [] },
      items,
      setAsideLeftWork: true,
      today: wednesday,
    });

    const standIn = items.find((item) => item.key === "skill:s2");

    expect(standIn?.scheduledFor?.getTime()).toBeLessThan(wednesday.getTime());

    expect(next.items.find((item) => item.key === "skill:s2")).toMatchObject({
      id: standIn?.id,
      status: "skipped",
    });

    const left = items.filter(
      (item) => item.kind === "lesson" && (item.scheduledFor ?? wednesday) < wednesday,
    );

    expect(
      left.map((item) => next.items.find((entry) => entry.key === item.key)?.status),
    ).not.toContain(undefined);
  });

  it("plans the lessons written for a stand-in an earlier day left in its place, never setting it aside", () => {
    const input = planInput({
      graph: {
        phases: [{ milestone: null, name: "Only" }],
        skills: [skill("s2", { lessons: 4 }), skill("s1", { lessons: 4 })],
      },
      lessons: lessonsFor("s1", 4),
    });

    const items = store(buildPlan(input));

    const next = buildPlan({
      ...input,
      carryOver: { lessonIds: [] },
      items,
      lessons: [...lessonsFor("s1", 4), ...lessonsFor("s2", 4)],
      setAsideLeftWork: true,
      today: wednesday,
    });

    expect(items.find((item) => item.key === "skill:s2")?.scheduledFor?.getTime()).toBeLessThan(
      wednesday.getTime(),
    );

    expect(next.items.find((item) => item.key === "skill:s2")).toBeUndefined();

    expect(todoLessons(next)).toStrictEqual(
      [...lessonsFor("s1", 4), ...lessonsFor("s2", 4)]
        .map((entry) => `lesson:${entry.lessonId}`)
        .toSorted(),
    );
  });

  it("leaves days already past alone on automatic runs, for the next day's settling", () => {
    const first = buildPlan(cycleInput());
    const items = store(first);

    const next = buildPlan(cycleInput({ items, mode: "automatic", today: tuesday }));

    expect(lessonsOn(next, monday)).toStrictEqual(lessonsOn(first, monday));
  });
});

describe("a gap whose lessons a test-out skipped", () => {
  it("studies its lessons that came back as its core when time is short", () => {
    const gap = Array.from({ length: 6 }, (_, index) => lesson(`g${index}`, ["g"]));
    const other = Array.from({ length: 6 }, (_, index) => lesson(`o${index}`, ["o"]));

    const items = gap
      .slice(0, 4)
      .map((entry, index) =>
        existing({
          completedAt: TODAY,
          id: `tested-${index}`,
          lessonId: entry.lessonId,
          position: index,
          scheduledFor: TODAY,
          skillId: "g",
          status: "testedOut",
        }),
      );

    const built = buildPlan(
      planInput({
        goal: { dailyMinutes: 6, kind: "learn", targetDate: addDays(TODAY, 4) },
        graph: {
          phases: [{ milestone: null, name: "Only" }],
          skills: [skill("o", { lessons: 6 }), skill("g", { lessons: 6 })],
        },
        items,
        lessons: [...other, ...gap],
        missedSkillIds: new Set(["g"]),
      }),
    );

    const planned = new Set(built.items.flatMap((item) => item.lessonId ?? []));

    expect(planned.has("g4")).toBe(true);
  });
});

describe("the lessons the plan counts for a skill", () => {
  it("leaves out a lesson whose title another skill's lesson holds", () => {
    const repeated = { ...lesson("r1", ["needs"]), title: "Lesson o1" };

    const built = buildPlan(
      planInput({
        graph: {
          phases: [{ milestone: null, name: "Only" }],
          skills: [skill("o", { lessons: 2 }), skill("needs", { lessons: 4 })],
        },
        lessons: [lesson("o1", ["o"]), lesson("o2", ["o"]), ...lessonsFor("needs", 3), repeated],
      }),
    );

    expect(built.skillLessons.get("needs")).toBe(3);
  });
});
