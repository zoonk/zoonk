import { describe, expect, it } from "vitest";
import { getPlanInputsKey, shouldSkipPlanBuild } from "../_utils/plan-inputs-key";
import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import { placeLandedLessons } from "./landed-placement";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson, type QueueUnit } from "./plan-units";
import { type PlanDay } from "./schedule-units";
import { listSelectedItemFacts } from "./selected-item-facts";

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

const days: PlanDay[] = Array.from({ length: 7 }, (_, offset) => ({
  date: addDays(TODAY, offset),
  shape: { events: [], minutes: 20, open: true, phase: 0, share: 0.5 },
}));

function lessonUnits(skillId: string, count: number): QueueUnit[] {
  return Array.from({ length: count }, (_, index) =>
    unit({ key: `lesson:${skillId}-${index}`, lessonId: `${skillId}-${index}`, skillId }),
  );
}

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

function saveItems(plan: { items: readonly PlannedItem[] }): ExistingPlanItem[] {
  return plan.items.map((entry, position) => ({ ...entry, id: entry.id ?? entry.key, position }));
}

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

/** A stand-in saved with the lesson minutes each day from today holds for it. */
function standIn(skillId: string, held: readonly number[]): ExistingPlanItem {
  const total = held.reduce((sum, minutes) => sum + minutes, 0);

  return item({
    facts: {
      days: held.flatMap((minutes, offset) =>
        minutes > 0 ? [[toIsoDate(addDays(TODAY, offset)), minutes * 2, minutes]] : [],
      ),
      minutes: total * 2,
      parts: { checkpoint: 0, practice: 0, unwritten: total, written: 0 },
      schemaVersion: 1,
      skillIds: [skillId],
    },
    id: skillId,
    position: 0,
    skillId,
  });
}

/** A written lesson the run keeps on its day. */
function keptLesson(lessonId: string, offset: number, minutes = 5) {
  const skillId = lessonId.split("-")[0] ?? "";

  return {
    item: item({
      id: lessonId,
      lessonId,
      position: 1,
      scheduledFor: addDays(TODAY, offset),
      skillId,
    }),
    unit: unit({ key: `lesson:${lessonId}`, lessonId, minutes, skillId }),
  };
}

function place({
  done = [],
  end = null,
  kept,
  landed,
  planDays = days,
  skillId = "law",
  standIn: held,
}: {
  done?: ExistingPlanItem[];
  end?: Date | null;
  kept: ReturnType<typeof keptLesson>[];
  landed: QueueUnit[];
  planDays?: PlanDay[];
  skillId?: string;
  standIn: ExistingPlanItem;
}) {
  const frozen = kept.map((entry) => entry.item);
  const units = [...kept.map((entry) => entry.unit), ...landed];

  const { dropped, placed } = placeLandedLessons({
    days: planDays,
    end,
    frozen,
    input: { ...input, items: [held, ...frozen, ...done] },
    landed: new Map([[skillId, landed]]),
    units,
    unitsByKey: new Map(units.map((entry) => [entry.key, entry])),
  });

  return {
    dates: placed.map((entry) => [entry.key, toIsoDate(entry.date)]),
    dropped: dropped.map((entry) => entry.key),
  };
}

describe(placeLandedLessons, () => {
  it("starts a topic's lessons where its stand-in's time did, in the room kept lessons leave", () => {
    const placed = place({
      kept: [keptLesson("politics-0", 0)],
      landed: lessonUnits("law", 2),
      standIn: standIn("law", [5, 5]),
    });

    expect(placed.dates).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-13"],
    ]);
  });

  it("keeps the stand-in's own time for its lessons on a day kept work fills past its time", () => {
    const placed = place({
      kept: [keptLesson("politics-0", 0), keptLesson("politics-1", 0), keptLesson("politics-2", 0)],
      landed: lessonUnits("law", 2),
      standIn: standIn("law", [5, 5]),
    });

    expect(placed.dates).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-13"],
    ]);
  });

  it("puts lessons that take longer than their stand-in held on the next days with room", () => {
    const placed = place({
      kept: [keptLesson("politics-0", 1, 10)],
      landed: lessonUnits("law", 3),
      standIn: standIn("law", [8]),
    });

    expect(placed.dates).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-12"],
      ["lesson:law-2", "2026-10-14"],
    ]);
  });

  it("never puts a lesson on a day with no lesson time", () => {
    const mock = { key: "mock", kind: "mock", minutes: 20, replacesDay: true, title: "" } as const;

    const placed = place({
      kept: [keptLesson("politics-0", 0)],
      landed: lessonUnits("law", 2),
      planDays: days.map((day, offset) =>
        offset === 1 ? { ...day, shape: { ...day.shape, events: [mock] } } : day,
      ),
      standIn: standIn("law", [5, 5]),
    });

    expect(placed.dates).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-14"],
    ]);
  });

  it("places only the lessons that begin by the last day the run keeps", () => {
    const placed = place({
      end: addDays(TODAY, 1),
      kept: [keptLesson("politics-0", 0), keptLesson("politics-1", 1, 7)],
      landed: lessonUnits("law", 3),
      standIn: standIn("law", [5, 3, 0, 0, 8]),
    });

    expect(placed.dates).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-14"],
    ]);

    expect(placed.dropped).toStrictEqual([]);
  });

  it("leaves out for time the lessons no day by the goal's date has room for", () => {
    const placed = place({
      kept: days.slice(1).map((_, index) => keptLesson(`politics-${index}`, index + 1, 10)),
      landed: lessonUnits("law", 3),
      standIn: standIn("law", [10]),
    });

    expect(placed.dates).toStrictEqual([
      ["lesson:law-0", "2026-10-12"],
      ["lesson:law-1", "2026-10-12"],
    ]);

    expect(placed.dropped).toStrictEqual(["lesson:law-2"]);
  });
});

function placeEssays(done: ExistingPlanItem[]) {
  return place({
    done,
    kept: [keptLesson("law-1", 3)],
    landed: lessonUnits("essays", 2),
    skillId: "essays",
    standIn: standIn("essays", [10]),
  });
}

describe("a landed skill's lessons and the base it builds on", () => {
  it("waits for the first lesson of a base the learner hasn't begun", () => {
    expect(placeEssays([]).dates).toStrictEqual([
      ["lesson:essays-0", "2026-10-15"],
      ["lesson:essays-1", "2026-10-16"],
    ]);
  });

  it("keeps its stand-in's days when the learner began the base", () => {
    const begun = item({
      completedAt: TODAY,
      id: "law-0",
      lessonId: "law-0",
      position: 1,
      skillId: "law",
      status: "done",
    });

    expect(placeEssays([begun]).dates).toStrictEqual([
      ["lesson:essays-0", "2026-10-12"],
      ["lesson:essays-1", "2026-10-12"],
    ]);
  });
});

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

function others(plan: { items: readonly (ExistingPlanItem | PlannedItem)[] }) {
  return plan.items
    .filter((entry) => entry.skillId !== "landed")
    .map((entry) => [
      getItemKey({ ...entry, id: entry.id ?? "" }),
      toIsoDate(entry.scheduledFor ?? TODAY),
    ]);
}

function lessonsAndChallenges(plan: { items: readonly PlannedItem[] }) {
  return others(plan).filter(([key]) => !key?.startsWith("checkpoint:"));
}

function firstTopic(plan: { items: readonly PlannedItem[] }) {
  return lessonsAndChallenges(plan).filter(([key]) => key?.startsWith("lesson:first-"));
}

/** A lesson can run over two days, so a day's time is what each lesson spends on it. */
function busiestDay(plan: Pick<BuiltPlan, "lessonDayMinutes">) {
  const perDay = [...plan.lessonDayMinutes.values()]
    .flatMap((byDay) => [...byDay])
    .reduce(
      (totals, [date, minutes]) => totals.set(date, (totals.get(date) ?? 0) + minutes),
      new Map<string, number>(),
    );

  return Math.max(...perDay.values());
}

function busiest(plan: { items: readonly PlannedItem[] }) {
  const perDay = Map.groupBy(
    plan.items.filter((entry) => entry.kind === "lesson" && entry.lessonId),
    (entry) => toIsoDate(entry.scheduledFor ?? TODAY),
  );

  return Math.max(
    ...[...perDay.values()].map((list) => list.reduce((sum, entry) => sum + entry.minutes, 0)),
  );
}

describe.each([false, true])(
  "lessons that land in a stand-in's place (landing only: %s)",
  (landedOnly) => {
    it("keeps a shown title once when the duplicate lands in a placeholder's place", () => {
      const first = buildPlan(learn);

      const landedLessons = writeLessons({ count: 8, minutes: 3, skillId: "landed" }).map(
        (lesson, index) => (index === 1 ? { ...lesson, title: "First 1" } : lesson),
      );

      const next = buildPlan({
        ...learn,
        items: saveItems(first),
        landedOnly,
        lessons: [...learn.lessons, ...landedLessons],
        mode: "automatic",
      });

      expect(
        next.items.filter((entry) => entry.titleSnapshot.toLowerCase() === "first 1"),
      ).toHaveLength(1);

      expect(next.items.some((entry) => entry.lessonId === "landed-2")).toBe(true);
    });

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

    it("push what follows later, and no day past the learner's time, when they take longer than planned", () => {
      const first = buildPlan(learn);

      const next = buildPlan({
        ...learn,
        items: saveItems(first),
        landedOnly,
        lessons: [...learn.lessons, ...writeLessons({ count: 8, minutes: 5, skillId: "landed" })],
        mode: "automatic",
      });

      expect(lessonsAndChallenges(next).map(([key]) => key)).toStrictEqual(
        lessonsAndChallenges(first).map(([key]) => key),
      );

      expect(firstTopic(next)).toStrictEqual(firstTopic(first));
      expect(next.items.filter((entry) => entry.skillId === "landed")).toHaveLength(8);
      expect(busiestDay(next)).toBeLessThanOrEqual(learn.goal.dailyMinutes);
    });
  },
);

function saveLater(plan: { items: readonly PlannedItem[] }): ExistingPlanItem[] {
  const nextWeek = addDays(TODAY, 7);

  return saveItems(plan).map((entry) =>
    entry.skillId !== "landed" && entry.scheduledFor && entry.scheduledFor >= nextWeek
      ? { ...entry, scheduledFor: addDays(entry.scheduledFor, 1) }
      : entry,
  );
}

describe("a run whose only news is lessons that landed", () => {
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

function begunStandIns(plan: { items: readonly PlannedItem[] }) {
  return plan.items.filter(
    (entry) => entry.skillId === "begun" && entry.kind === "lesson" && !entry.lessonId,
  );
}

describe("a topic whose first chapter the learner already began", () => {
  const friday = addDays(TODAY, 4);

  const begun = {
    goal: { dailyMinutes: 16, kind: "language", targetDate: null },
    graph: {
      phases: [{ milestone: null, name: "Only" }],
      skills: [
        { ...skill("begun", "Begun"), lessons: 24 },
        { ...skill("after", "After"), lessons: 24 },
      ],
    },
    items: [],
    lessons: [
      ...writeLessons({ count: 4, minutes: 4, skillId: "begun" }),
      ...writeLessons({ count: 4, minutes: 4, skillId: "after" }),
    ],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({}),
    today: addDays(friday, -3),
  } satisfies BuildPlanInput;

  /** The learner finished the first chapter and opened today, whose session holds the rest's stand-in. */
  function openToday() {
    const studied = saveItems(buildPlan(begun)).map((entry) =>
      entry.lessonId?.startsWith("begun-")
        ? { ...entry, completedAt: addDays(friday, -1), status: "done" as const }
        : entry,
    );

    const day = { ...begun, items: studied, mode: "automatic" as const, today: friday };
    const opened = buildPlan({ ...day, todayShown: true });

    return { day, opened };
  }

  const rest = Array.from({ length: 20 }, (_, index) => ({
    chapterId: "begun-next",
    lessonId: `begun-next-${index}`,
    minutes: 4,
    skillIds: ["begun"],
    title: `Begun next ${index}`,
  }));

  it("holds today's time for the rest of its lessons", () => {
    const { opened } = openToday();

    expect(
      begunStandIns(opened).map((entry) => toIsoDate(entry.scheduledFor ?? TODAY)),
    ).toStrictEqual([toIsoDate(friday)]);
  });

  it("drops the stand-in once the rest of its lessons are written, though other news came with them", () => {
    const { day, opened } = openToday();

    const next = buildPlan({
      ...day,
      items: saveItems(opened),
      lessons: [...begun.lessons, ...rest],
      todayShown: true,
    });

    const written = next.items.filter((entry) => entry.lessonId?.startsWith("begun-next-"));

    expect(begunStandIns(next)).toStrictEqual([]);
    expect(written).toHaveLength(rest.length);
  });

  it("rebuilds a saved plan that still holds the stand-in, though nothing it plans from changed", () => {
    const { day, opened } = openToday();
    const lessons = [...begun.lessons, ...rest];
    const saved = { ...day, items: saveItems(opened), lessons, todayShown: true };
    const savedKey = getPlanInputsKey({ input: saved, items: opened.items });

    expect(shouldSkipPlanBuild({ input: saved, savedKey, skipUnchangedInputs: true })).toBe(false);
  });

  it("never sets the stand-in aside as work left once a missed day passes", () => {
    const { day, opened } = openToday();

    const next = buildPlan({
      ...day,
      items: saveItems(opened),
      lessons: [...begun.lessons, ...rest],
      setAsideLeftWork: true,
      today: addDays(friday, 1),
    });

    expect(begunStandIns(next)).toStrictEqual([]);
  });
});

const TOPICS = ["t1", "t2", "t3", "t4"];
const TOPIC_LESSONS = 40;
const CHAPTER = 10;
const DAILY_MINUTES = 15;

/** Four topics no lesson is written for yet, studied 15 minutes a day from Monday to Friday. */
function topics(kind: "language" | "learn") {
  return {
    goal: { dailyMinutes: DAILY_MINUTES, kind, targetDate: null },
    graph: {
      phases: [{ milestone: null, name: "Only" }],
      skills: TOPICS.map((skillId) => ({
        area: skillId,
        lessons: TOPIC_LESSONS,
        name: skillId,
        phase: 0,
        skillId,
        weight: 1,
      })),
    },
    items: [],
    lessons: [],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({
      startDate: "2026-09-28",
      weekdayMinutes: [0, 15, 15, 15, 15, 15, 0],
    }),
    today: fromIsoDate("2026-09-28"),
  } satisfies BuildPlanInput;
}

function firstChapter(skillId: string, minutes: number): PlannerLesson[] {
  return Array.from({ length: CHAPTER }, (_, index) => ({
    chapterId: `${skillId}-first`,
    lessonId: `${skillId}-${index}`,
    minutes,
    skillIds: [skillId],
    title: `${skillId} ${index}`,
  }));
}

function saveWithDays(plan: BuildPlanInput): ExistingPlanItem[] {
  const built = buildPlan(plan);
  const facts = listSelectedItemFacts({ built, input: plan });

  return built.items.map((entry, position) => ({
    ...entry,
    facts: { ...facts.get(entry.key), schemaVersion: 1 } as ExistingPlanItem["facts"],
    id: entry.id ?? entry.key,
    position,
  }));
}

function daysOver(plan: Pick<BuiltPlan, "lessonDayMinutes">): string[] {
  const perDay = [...plan.lessonDayMinutes.values()]
    .flatMap((byDay) => [...byDay])
    .reduce(
      (totals, [date, minutes]) => totals.set(date, (totals.get(date) ?? 0) + minutes),
      new Map<string, number>(),
    );

  return [...perDay].flatMap(([date, minutes]) =>
    minutes > DAILY_MINUTES + 0.01 ? [`${date}: ${Math.round(minutes)}`] : [],
  );
}

function chapterEnd(plan: { items: readonly PlannedItem[] }, skillId: string): Date {
  const dates = plan.items.flatMap((entry) =>
    entry.lessonId?.startsWith(`${skillId}-`) && entry.scheduledFor ? [entry.scheduledFor] : [],
  );

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function unwrittenMinutes(plan: Pick<BuiltPlan, "lessonRawMinutes">, skillId: string): number {
  return [...(plan.lessonRawMinutes.get(`skill:${skillId}`)?.values() ?? [])].reduce(
    (total, minutes) => total + minutes,
    0,
  );
}

function daysApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/** The first chapters of three topics are written on the plan's first day. */
function writtenOnDayOne(kind: "language" | "learn", minutes: number) {
  const plan = topics(kind);

  return {
    landed: ["t1", "t2", "t3"],
    next: {
      ...plan,
      items: saveWithDays(plan),
      lessons: ["t1", "t2", "t3"].flatMap((skillId) => firstChapter(skillId, minutes)),
    },
  };
}

/**
 * The learner studied every lesson of the first topic the plan gave them, and the next topic's
 * first chapter is written five weeks in.
 */
function writtenFiveWeeksIn(kind: "language" | "learn", minutes: number) {
  const base = topics(kind);
  const today = fromIsoDate("2026-11-02");

  const plan = {
    ...base,
    lessons: [
      ...firstChapter("t1", 5),
      ...Array.from({ length: TOPIC_LESSONS - CHAPTER }, (_, index) => ({
        chapterId: "t1-second",
        lessonId: `t1-next-${index}`,
        minutes: 4,
        skillIds: ["t1"],
        title: `t1 next ${index}`,
      })),
    ],
  };

  const items = saveWithDays(plan).map((entry) =>
    entry.skillId === "t1" && entry.scheduledFor && entry.scheduledFor < today
      ? { ...entry, completedAt: entry.scheduledFor, status: "done" as const }
      : entry,
  );

  return {
    landed: ["t2"],
    next: { ...plan, items, lessons: [...plan.lessons, ...firstChapter("t2", minutes)], today },
  };
}

describe.each(["language", "learn"] as const)("lessons written for a %s plan's topics", (kind) => {
  describe.each([4, 5, 8, 12])("each %s minutes long", (minutes) => {
    describe.each([
      ["on the plan's first day", writtenOnDayOne],
      ["five weeks in", writtenFiveWeeksIn],
    ] as const)("%s", (_, write) => {
      it.each([false, true])(
        "keep every day to the learner's time, near a full re-plan, with the rest of the topic (landing only: %s)",
        (landedOnly) => {
          const { landed, next } = write(kind, minutes);
          const forced = buildPlan({ ...next, mode: "forced" });
          const built = buildPlan({ ...next, landedOnly, mode: "automatic" });

          expect(daysOver(built)).toStrictEqual([]);

          expect(
            landed.map(
              (skillId) =>
                built.items.filter((entry) => entry.lessonId?.startsWith(`${skillId}-`)).length,
            ),
          ).toStrictEqual(landed.map(() => CHAPTER));

          expect(
            landed.filter(
              (skillId) => daysApart(chapterEnd(built, skillId), chapterEnd(forced, skillId)) > 7,
            ),
          ).toStrictEqual([]);

          expect(
            landed.map((skillId) => Math.round(unwrittenMinutes(built, skillId))),
          ).toStrictEqual(landed.map(() => (TOPIC_LESSONS - CHAPTER) * 4));
        },
      );
    });
  });
});
