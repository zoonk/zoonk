import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { putLandedLessons } from "./landed-placement";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson, type QueueUnit } from "./plan-units";
import { type PlanDay, type ScheduledUnit } from "./schedule-units";

/** A Monday. */
const TODAY = fromIsoDate("2026-10-12");

function skill(skillId: string, area: string): PlanGraphSkill {
  return { area, lessons: 6, name: skillId, phase: 0, skillId, weight: 1 };
}

function item(
  attrs: Partial<ExistingPlanItem> & Pick<ExistingPlanItem, "id" | "position" | "skillId">,
): ExistingPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    kind: "lesson",
    lessonId: null,
    phase: 0,
    scheduledFor: TODAY,
    status: "todo",
    titleSnapshot: attrs.id,
    ...attrs,
  };
}

function unit(attrs: Partial<QueueUnit> & Pick<QueueUnit, "key" | "skillId">): QueueUnit {
  return {
    area: "",
    chapterId: null,
    kind: "lesson",
    lessonId: null,
    minutes: 5,
    phase: 0,
    title: attrs.key,
    ...attrs,
  };
}

/** A unit as a run laid it out, `offset` days from today. */
function laid(entry: QueueUnit, offset: number): ScheduledUnit {
  return { ...entry, date: addDays(TODAY, offset), studyMinutes: entry.minutes * 2 };
}

/** A week of days, each with 10 minutes for lessons. */
const days: PlanDay[] = Array.from({ length: 7 }, (_, offset) => ({
  date: addDays(TODAY, offset),
  shape: { events: [], minutes: 20, open: true, phase: 0, share: 0.5 },
}));

/** A skill's stand-in as a part about a lesson long. */
function part(skillId: string): QueueUnit {
  return unit({ key: `skill:${skillId}`, lessons: 6, minutes: 4, skillId });
}

/** A skill's lessons, as a run's queue has them. */
function lessonUnits(skillId: string, count: number): QueueUnit[] {
  return Array.from({ length: count }, (_, index) =>
    unit({ key: `lesson:${skillId}-${index}`, lessonId: `${skillId}-${index}`, skillId }),
  );
}

/** A skill's lessons the Library wrote, each `minutes` long. */
function writeLessons({
  count,
  minutes,
  skillId,
}: {
  count: number;
  minutes: number;
  skillId: string;
}): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterId: `${skillId}-chapter`,
    lessonId: `${skillId}-${index}`,
    minutes,
    skillIds: [skillId],
    title: `${skillId} ${index}`,
  }));
}

/** A plan's items as the plan saves them. */
function saveItems(plan: { items: readonly PlannedItem[] }): ExistingPlanItem[] {
  return plan.items.map((entry, position) => ({ ...entry, id: entry.id ?? entry.key, position }));
}

/** An exam's input: three subjects of one skill each, essays built on law. */
const input = {
  goal: { dailyMinutes: 20, kind: "exam", targetDate: fromIsoDate("2026-12-20") },
  graph: {
    phases: [{ milestone: null, name: "Everything" }],
    skills: [skill("politics", "Politics"), skill("law", "Law"), skill("essays", "Essays")],
  },
  items: [],
  lessons: [],
  mockMinutes: 150,
  mode: "automatic",
  paceFactor: 1,
  prerequisites: new Map([["essays", ["law"]]]),
  readiness: new Map(),
  settings: parsePlanSettings({}),
  today: TODAY,
} satisfies BuildPlanInput;

function datesOf(placed: { landed: ScheduledUnit[]; laidOut: ScheduledUnit[] }, skillId: string) {
  return [...placed.landed, ...placed.laidOut]
    .filter((entry) => entry.skillId === skillId)
    .map((entry) => [entry.key, toIsoDate(entry.date)]);
}

describe(putLandedLessons, () => {
  // Câmara seed 2030: the other stand-ins of its day held all of that day's time, so the landed
  // linguistics base went where the week had time left, two days after the first essay built on
  // it. A skill's lessons take its stand-in's place: the first keeps the stand-in's day.
  it("starts a landed skill on its stand-in's day though other stand-ins hold that day's time", () => {
    const placed = putLandedLessons({
      days,
      input: { ...input, items: [item({ id: "law", position: 1, skillId: "law" })] },
      keptParts: [],
      landed: new Map([["law", lessonUnits("law", 2)]]),
      start: addDays(TODAY, 7),
      units: [
        laid(part("politics"), 0),
        laid(part("politics"), 0),
        laid(part("law"), 1),
        laid(part("law"), 1),
        laid(unit({ key: "lesson:essays-1", lessonId: "essays-1", skillId: "essays" }), 2),
      ],
    });

    expect(datesOf(placed, "law")).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-13"],
    ]);
  });

  // Lessons that take longer than their stand-in held go on the next days with room, past a
  // challenge too (Today then offers to move its end, N90): the ones no day by the goal's date has
  // room for are left out for time, so the plan says it covers less.
  it("leaves out for time the lessons no day by the goal's date has room for", () => {
    const placed = putLandedLessons({
      days,
      input: { ...input, items: [item({ id: "law", position: 1, skillId: "law" })] },
      keptParts: [],
      landed: new Map([["law", lessonUnits("law", 3)]]),
      start: addDays(TODAY, 7),
      units: [
        laid({ ...part("law"), minutes: 12 }, 0),
        ...days.map((_, offset) => laid({ ...part("politics"), minutes: 10 }, offset)),
      ],
    });

    expect(datesOf(placed, "law")).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-12"],
    ]);

    expect(placed.leftOut.map((entry) => entry.key)).toStrictEqual(["lesson:law-2"]);
  });

  // The Library wrote three lessons for a learn plan's skill the graph sized at two, and the
  // third was left out of a plan with no date and time to spare.
  it("puts more lessons than its stand-in's time held on the next days with room", () => {
    const placed = putLandedLessons({
      days,
      input: { ...input, items: [item({ id: "law", position: 1, skillId: "law" })] },
      keptParts: [],
      landed: new Map([["law", lessonUnits("law", 3)]]),
      start: addDays(TODAY, 7),
      units: [laid({ ...part("law"), minutes: 8 }, 0)],
    });

    expect(datesOf(placed, "law")).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-12"],
      ["lesson:law-2", "2026-10-13"],
    ]);

    expect(placed.leftOut).toStrictEqual([]);
  });

  // A plan short on time cut part of the skill: its stand-in held only what the cut kept.
  it("leaves out lessons past its stand-in's time when the run's cut left part of the skill out", () => {
    const placed = putLandedLessons({
      days,
      dropped: [{ ...part("law"), fittedMinutes: 0 }],
      input: { ...input, items: [item({ id: "law", position: 1, skillId: "law" })] },
      keptParts: [],
      landed: new Map([["law", lessonUnits("law", 3)]]),
      start: addDays(TODAY, 7),
      units: [laid({ ...part("law"), minutes: 8 }, 0)],
    });

    expect(datesOf(placed, "law")).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-12"],
    ]);

    expect(placed.leftOut.map((entry) => entry.key)).toStrictEqual(["lesson:law-2"]);
  });

  // Class test seed 1012: a lesson longer than a day's time takes a day of its own, and one written
  // since went on the test's last day, which its short mock takes whole (R23).
  it("never puts a lesson longer than a day's time on a day with no lesson time", () => {
    const mock = { key: "mock", kind: "mock", minutes: 20, replacesDay: true, title: "" } as const;

    const placed = putLandedLessons({
      days: days.map((day, offset) =>
        offset === 1 ? { ...day, shape: { ...day.shape, events: [mock] } } : day,
      ),
      input: { ...input, items: [item({ id: "law", position: 1, skillId: "law" })] },
      keptParts: [],
      landed: new Map([
        [
          "law",
          [
            unit({ key: "lesson:law-0", lessonId: "law-0", skillId: "law" }),
            unit({ key: "lesson:law-1", lessonId: "law-1", minutes: 15, skillId: "law" }),
          ],
        ],
      ]),
      start: addDays(TODAY, 7),
      units: [laid({ ...part("law"), minutes: 8 }, 0)],
    });

    expect(datesOf(placed, "law")).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-14"],
    ]);
  });

  // IELTS seed 2031: a practice change that morning left today's lessons less time than Today
  // showed. The landed lessons of today's stand-in went to later days, and it left the session.
  it("keeps a landed stand-in in the session Today showed, with no time left that day", () => {
    const placed = putLandedLessons({
      days,
      input: {
        ...input,
        items: [item({ id: "writing", position: 1, skillId: "law" })],
        todayShown: true,
      },
      keptParts: [],
      landed: new Map([["law", lessonUnits("law", 2)]]),
      start: addDays(TODAY, 7),
      units: [
        laid(part("politics"), 0),
        laid(part("politics"), 0),
        laid(part("politics"), 0),
        laid(part("law"), 0),
        laid(part("law"), 0),
      ],
    });

    expect(datesOf(placed, "law")).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-13"],
    ]);
  });
});

/** Essays landed on today's stand-in; law, which essays builds on, has its next lesson in 3 days. */
function placeEssays(lawItems: ExistingPlanItem[]) {
  return putLandedLessons({
    days,
    input: {
      ...input,
      items: [item({ id: "essays", position: 0, skillId: "essays" }), ...lawItems],
    },
    keptParts: [],
    landed: new Map([["essays", lessonUnits("essays", 2)]]),
    start: addDays(TODAY, 7),
    units: [
      laid(part("essays"), 0),
      laid(part("essays"), 0),
      laid(unit({ key: "lesson:law-1", lessonId: "law-1", skillId: "law" }), 3),
    ],
  });
}

describe("a landed skill's lessons and the base it builds on", () => {
  // Career seed 2147: put where its stand-in's time began, a skill's lessons came two days before
  // the first lesson of the interface hierarchy they build on (R16).
  it("waits for the first lesson of a base the learner hasn't begun", () => {
    const placed = placeEssays([]);

    expect(datesOf(placed, "essays")).toStrictEqual([
      ["lesson:essays-0", "2026-10-15"],
      ["lesson:essays-1", "2026-10-16"],
    ]);
  });

  // Câmara seed 1263: the learner had done 9 lessons of the base, and the landed skill's lessons
  // waited for its next one, a month past their stand-in's day.
  it("keeps its stand-in's days when the learner began the base", () => {
    const placed = placeEssays([
      item({
        completedAt: TODAY,
        id: "law-0",
        lessonId: "law-0",
        position: 1,
        skillId: "law",
        status: "done",
      }),
    ]);

    expect(datesOf(placed, "essays")).toStrictEqual([
      ["lesson:essays-0", "2026-10-12"],
      ["lesson:essays-1", "2026-10-12"],
    ]);
  });
});

/** A learn plan: four lessons, then a skill not outlined yet, then four more. */
const learn = {
  goal: { dailyMinutes: 12, kind: "learn", targetDate: null },
  graph: {
    phases: [{ milestone: null, name: "Only" }],
    skills: [
      { ...skill("first", "First"), lessons: 4 },
      { ...skill("landed", "Landed"), lessons: 8 },
      { ...skill("last", "Last"), lessons: 4 },
    ],
  },
  items: [],
  lessons: [
    ...writeLessons({ count: 4, minutes: 3, skillId: "first" }),
    ...writeLessons({ count: 4, minutes: 3, skillId: "last" }),
  ],
  mockMinutes: 150,
  mode: "forced",
  paceFactor: 1,
  prerequisites: new Map(),
  readiness: new Map(),
  settings: parsePlanSettings({}),
  today: TODAY,
} satisfies BuildPlanInput;

/** Every item of the plan but the landed skill's, with its day. */
function others(plan: { items: readonly (ExistingPlanItem | PlannedItem)[] }) {
  return plan.items
    .filter((entry) => entry.skillId !== "landed")
    .map((entry) => [
      getItemKey({ ...entry, id: entry.id ?? "" }),
      toIsoDate(entry.scheduledFor ?? TODAY),
    ]);
}

/** Every lesson and challenge of the plan but the landed skill's, without its weekly ones. */
function lessonsAndChallenges(plan: { items: readonly PlannedItem[] }) {
  return others(plan).filter(([key]) => !key?.startsWith("checkpoint:"));
}

/** The most time any day's lessons take. */
function busiest(plan: { items: readonly PlannedItem[] }) {
  const perDay = Map.groupBy(
    plan.items.filter((entry) => entry.kind === "lesson" && entry.lessonId),
    (entry) => toIsoDate(entry.scheduledFor ?? TODAY),
  );

  return Math.max(
    ...[...perDay.values()].map((list) => list.reduce((sum, entry) => sum + entry.minutes, 0)),
  );
}

// Planned again from the plan as saved (`landedOnly` absent) or kept as saved (`landedOnly`), the
// landed lessons take their stand-in's time the same way.
describe.each([false, true])(
  "lessons that land in a stand-in's place (landing only: %s)",
  (landedOnly) => {
    it("take the days their stand-in's time held and move nothing else", () => {
      const first = buildPlan(learn);

      const next = buildPlan({
        ...learn,
        items: saveItems(first),
        landedOnly,
        lessons: [...learn.lessons, ...writeLessons({ count: 8, minutes: 3, skillId: "landed" })],
        mode: "automatic",
      });

      expect(others(next)).toStrictEqual(others(first));
      expect(busiest(next)).toBeLessThanOrEqual(learn.goal.dailyMinutes);
      expect(next.items.filter((entry) => entry.skillId === "landed")).toHaveLength(8);
    });

    // ENEM seed 2080: the stand-in Friday began ran on into the next week. Its lessons, written
    // since, all went on Friday, which went from 21 lessons to 44, far past the learner's time.
    it("never push a day past the learner's time when they take longer than planned", () => {
      const first = buildPlan(learn);

      const next = buildPlan({
        ...learn,
        items: saveItems(first),
        landedOnly,
        lessons: [...learn.lessons, ...writeLessons({ count: 8, minutes: 5, skillId: "landed" })],
        mode: "automatic",
      });

      // Past the plan's last challenge, they make the plan longer: its weekly challenge follows.
      expect(lessonsAndChallenges(next)).toStrictEqual(lessonsAndChallenges(first));
      expect(busiest(next)).toBeLessThanOrEqual(learn.goal.dailyMinutes);
    });
  },
);

/** The plan as an earlier run saved it: what came after this week a day later than now. */
function saveLater(plan: { items: readonly PlannedItem[] }): ExistingPlanItem[] {
  const nextWeek = addDays(TODAY, 7);

  return saveItems(plan).map((entry) =>
    entry.skillId !== "landed" && entry.scheduledFor && entry.scheduledFor >= nextWeek
      ? { ...entry, scheduledFor: addDays(entry.scheduledFor, 1) }
      : entry,
  );
}

describe("a run whose only news is lessons that landed", () => {
  /** A learn plan: two weeks of lessons, then a skill not outlined yet, then more lessons. */
  const long = {
    ...learn,
    graph: {
      ...learn.graph,
      skills: [
        { ...skill("first", "First"), lessons: 40 },
        { ...skill("landed", "Landed"), lessons: 8 },
        { ...skill("last", "Last"), lessons: 12 },
      ],
    },
    lessons: [
      ...writeLessons({ count: 40, minutes: 3, skillId: "first" }),
      ...writeLessons({ count: 12, minutes: 3, skillId: "last" }),
    ],
  } satisfies BuildPlanInput;

  // OAB seed 2003: planned again from the plan as saved, the next morning's landing laid the rest
  // out another way than the session's run that saved it, and swapped 10 lessons. Câmara seed 3:
  // the stand-in's time, laid out again, sat on a Saturday the saved plan had already filled, and
  // its landed lessons took that day from 70 minutes to 130.
  it("keeps every other item where the plan has it, and no more on a day than the learner's time", () => {
    const saved = saveLater(buildPlan(long));

    const next = buildPlan({
      ...long,
      items: saved,
      landedOnly: true,
      lessons: [...long.lessons, ...writeLessons({ count: 8, minutes: 3, skillId: "landed" })],
      mode: "automatic",
    });

    expect(others(next)).toStrictEqual(others({ items: saved }));
    expect(next.items.filter((entry) => entry.skillId === "landed")).toHaveLength(8);
    expect(busiest(next)).toBeLessThanOrEqual(long.goal.dailyMinutes);
  });

  // A learn plan's landed lessons past this week came after every other item of their day: a
  // lesson more than its stand-in's time held went after the next skill's lessons that day.
  it("puts the landed lessons where their stand-in was in each day's order", () => {
    const roomy = { ...long, goal: { ...long.goal, dailyMinutes: 20 } };
    const saved = saveItems(buildPlan(roomy));

    const next = buildPlan({
      ...roomy,
      items: saved,
      landedOnly: true,
      lessons: [...roomy.lessons, ...writeLessons({ count: 10, minutes: 4, skillId: "landed" })],
      mode: "automatic",
    });

    const order = ["first", "landed", "last"];

    const byDay = Map.groupBy(
      next.items.filter((entry) => entry.kind === "lesson"),
      (entry) => toIsoDate(entry.scheduledFor ?? TODAY),
    );

    const skillsByDay = [...byDay.values()].map((list) => list.map((entry) => entry.skillId ?? ""));

    expect(skillsByDay).toStrictEqual(
      skillsByDay.map((skills) => skills.toSorted((a, b) => order.indexOf(a) - order.indexOf(b))),
    );
  });
});
