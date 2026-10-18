import { describe, expect, it } from "vitest";
import { getCheckpointMinutes } from "../../checkpoints/checkpoint-minutes";
import { CHECKPOINT_QUESTIONS } from "../../checkpoints/checkpoint-rules";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fundMocks } from "./mock-funding";
import { matchSavedMocks } from "./mock-identity";
import { withMovedEvents } from "./moved-events";
import { addDays, fromIsoDate, getPlanCalendar, toIsoDate } from "./plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "./plan-days";
import { type MovedEvent, type PlanGraph, parsePlanSettings } from "./plan-state";
import { type PlannedMocks, resolvePlannedMocks } from "./planned-mocks";
import { type PlanDay } from "./schedule-units";

/** A Monday. */
const MONDAY = fromIsoDate("2020-09-28");
const WEEKDAYS = [0, 30, 30, 30, 30, 30, 0];

function weekdays(minutes: number) {
  return [0, minutes, minutes, minutes, minutes, minutes, 0];
}

function examInput({
  dailyMinutes = 30,
  fullCourse = false,
  lessons,
  moves = [],
  targetDate,
  today = MONDAY,
  weekdayMinutes = WEEKDAYS,
}: {
  dailyMinutes?: number;
  weekdayMinutes?: number[];
  fullCourse?: boolean;
  lessons: number;
  moves?: MovedEvent[];
  targetDate: Date | null;
  today?: Date;
}): BuildPlanInput {
  const graph: PlanGraph = {
    phases: [{ milestone: null, name: "Base" }],
    skills: [
      { area: "Linguagens", lessons, name: "Linguagens", phase: 0, skillId: "L", weight: 1 },
    ],
  };

  return {
    fullMockMinutes: 330,
    goal: { dailyMinutes, kind: "exam", targetDate },
    graph,
    items: [],
    lessons: Array.from({ length: lessons }, (_, index) => ({
      chapterId: "chapter-L",
      lessonId: `L-${index}`,
      minutes: 4,
      skillIds: ["L"],
      title: `Linguagens ${index}`,
    })),
    mockMinutes: 165,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({
      fullCourse,
      movedEvents: moves,
      startDate: toIsoDate(MONDAY),
      weekdayMinutes,
    }),
    today,
  };
}

/** A built plan's items on a date, and the minutes Today and the Plan give that date. */
function readDay({
  built,
  date,
  input,
}: {
  built: ReturnType<typeof buildPlan>;
  date: string;
  input: BuildPlanInput;
}) {
  const settings = { ...input.settings, mockFunding: built.mockFunding };

  const budget = getPlannedMinutes({
    calendar: getPlanCalendar({ dailyMinutes: input.goal.dailyMinutes, settings }),
    date: fromIsoDate(date),
    exam: getExamDayRules({ isExam: true, settings }),
    targetDate: input.goal.targetDate,
  });

  const items = built.items.filter(
    (item) => item.scheduledFor && toIsoDate(item.scheduledFor) === date,
  );

  return { budget, items, minutes: items.reduce((total, item) => total + item.minutes, 0) };
}

/** A phase's checkpoint as it's played: its ten questions (see `getCheckpointMinutes`). */
const BOSS = getCheckpointMinutes(CHECKPOINT_QUESTIONS);

// "Move to Monday" puts the week's mock on a day that already holds something: the mock takes the
// whole day (`replacesDay`), so a review there gives way, and a phase's checkpoint there keeps its
// own time beside the mock. Either way the day's time is what the day asks for.
describe("a mock moved onto a day that holds something", () => {
  it("replaces the review of a day in the final stretch", () => {
    const input = examInput({
      lessons: 60,
      moves: [{ from: "2020-10-09", to: "2020-10-12" }],
      targetDate: fromIsoDate("2020-10-14"),
    });

    const built = buildPlan(input);
    const day = readDay({ built, date: "2020-10-12", input });

    // The phase's challenge the day after its lessons shares the day (see `placeExamBosses`).
    expect(day.items.map((item) => item.kind)).toContain("mock");
    expect(day.items.map((item) => item.kind)).not.toContain("review");
    expect(day.minutes).toBeCloseTo(day.budget);
  });

  // A phase's challenge stays on the study day after its lessons (see `placeExamBosses`): a mock
  // moved onto it shares the day, which asks for both when its days fund them.
  it("keeps a phase checkpoint's time beside it", () => {
    const plain = examInput({ lessons: 200, targetDate: fromIsoDate("2020-11-04") });

    const target = buildPlan(plain)
      .items.flatMap((item) =>
        item.kind === "boss" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
      )
      .find((date) => date > "2020-10-09");

    if (!target) {
      throw new Error("Expected a phase checkpoint after the first mock");
    }

    const input = examInput({
      lessons: 200,
      moves: [{ from: "2020-10-09", to: target }],
      targetDate: fromIsoDate("2020-11-04"),
    });

    const built = buildPlan(input);
    const day = readDay({ built, date: target, input });

    expect(
      day.items
        .map((item) => [item.kind, item.minutes] as const)
        .toSorted((a, b) => a[0].localeCompare(b[0])),
    ).toStrictEqual([
      ["boss", BOSS],
      ["mock", 165],
    ]);

    expect(day.budget).toBeCloseTo(165 + BOSS);
  });
});

// A plan with no date lays out only what it has: its mocks after its last lesson aren't in it, so
// no day sets time aside for them, in the plan or in what it saves for Today.
describe("an undated exam plan whose lessons end before its first mock", () => {
  it("saves no funding for a mock it doesn't plan", () => {
    const input = examInput({ lessons: 3, targetDate: null });
    const built = buildPlan(input);

    const mocks = new Set(
      built.items.flatMap((item) =>
        item.kind === "mock" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
      ),
    );

    expect(
      built.mockFunding.map((entry) => entry.date).filter((date) => !mocks.has(date)),
    ).toStrictEqual([]);

    // Each day keeps the learner's time unless a mock in the plan takes part of it.
    expect(readDay({ built, date: "2020-10-05", input }).budget).toBe(30);
  });
});

// A plan that goes on after its exam ends its lessons before the next weekly mock after it: that
// mock isn't in the plan, so its days keep all their time for the lessons left (Today shows them
// whole), instead of quietly setting part of it aside.
describe("the lessons after an exam that end before the next mock", () => {
  it("fill each day's time up to the last lesson", () => {
    const targetDate = fromIsoDate("2020-10-14");

    const input = examInput({
      dailyMinutes: 34,
      fullCourse: true,
      lessons: 60,
      targetDate,
      weekdayMinutes: weekdays(34),
    });

    const built = buildPlan(input);

    const lastMock =
      built.mockFunding
        .map((entry) => entry.date)
        .toSorted()
        .at(-1) ?? "";

    const tail = built.items.filter(
      (item) =>
        item.kind === "lesson" && item.scheduledFor && toIsoDate(item.scheduledFor) > lastMock,
    );

    const dates = [...new Set(tail.map((item) => toIsoDate(item.scheduledFor ?? targetDate)))];
    const lesson = Math.max(...tail.map((item) => item.minutes));

    expect(dates.length).toBeGreaterThan(2);

    // Every day but the last holds less than one lesson's time unscheduled: lessons don't split.
    expect(
      dates.slice(0, -1).filter((date) => {
        const day = readDay({ built, date, input });
        return day.budget - day.minutes >= lesson;
      }),
    ).toStrictEqual([]);
  });
});

/** Two weeks of a plan with 30 minutes on weekdays and Sundays, and its mocks. */
const listDays = (start: string, length: number, mocks: Record<string, number>): PlanDay[] =>
  Array.from({ length }, (_, offset) => {
    const date = addDays(fromIsoDate(start), offset);
    const iso = toIsoDate(date);
    const weekday = date.getUTCDay();
    const mock = mocks[iso];

    return {
      date,
      shape: {
        events:
          mock === undefined
            ? []
            : [
                {
                  key: `mock:${iso}`,
                  kind: "mock" as const,
                  minutes: mock,
                  replacesDay: true,
                  title: "",
                },
              ],
        minutes: weekday === 6 ? 0 : 30,
        open: true,
        phase: 0,
        share: 0.6,
      },
    };
  });

// The calendar moved the plan's next mock (a new study day changed the week's event day): what the
// days before it set aside for it, as they saved it, is credited once to the mock that took its
// place, not twice, nor to two mocks.
describe("banked time when the calendar moves the next mock", () => {
  const past = ["2020-09-28", "2020-09-29", "2020-09-30", "2020-10-01", "2020-10-02"].map(
    (date) => ({ date, minutes: 15 }),
  );

  it("credits the saved days once to the mock that took its place", () => {
    const funded = fundMocks({
      days: listDays("2020-10-05", 14, { "2020-10-11": 165, "2020-10-18": 165 }),
      funding: [{ contributions: past, date: "2020-10-09", minutes: 165 }],
      moves: [],
    });

    const [first, second] = funded.funding;

    expect(first?.date).toBe("2020-10-11");
    expect(first?.contributions.filter((given) => given.date < "2020-10-05")).toStrictEqual(past);
    expect(second?.contributions.filter((given) => given.date < "2020-10-05")).toStrictEqual([]);
  });
});

// A plan is saved only once its mocks hold (see `resolvePlannedMocks`): never a pass that still
// sets time aside for a mock it doesn't hold.
describe(resolvePlannedMocks, () => {
  const settled: PlannedMocks = {
    horizon: 2,
    mockFunding: [],
    next: null,
    relocations: [],
    unfundedMocks: [],
  };

  const unsettled: PlannedMocks = {
    ...settled,
    next: { identities: new Map(), released: new Set(["2020-10-09"]) },
  };

  it("plans again until the mocks hold", () => {
    const passes: (string[] | null)[] = [];

    const built = resolvePlannedMocks((resolution) => {
      passes.push(resolution ? [...resolution.released] : null);
      return { mocks: passes.length < 3 ? unsettled : settled };
    });

    expect(built.mocks.next).toBeNull();
    expect(passes).toStrictEqual([null, ["2020-10-09"], ["2020-10-09"]]);
  });

  it("refuses a plan whose mocks don't hold within its bound", () => {
    expect(() => resolvePlannedMocks(() => ({ mocks: unsettled }))).toThrow(
      "The plan's mocks didn't settle in 4 passes.",
    );
  });
});

/** A saved mock: its exam day and what past days set aside for it. */
function savedMock(date: string, day: number, given: number) {
  return {
    contributions: [{ date: "2020-10-01", minutes: given }],
    date,
    day,
    fullLength: false,
    minutes: 165,
  };
}

// Which saved mock a run's mock continues follows where it came from: a learner's move keeps the
// mock it moved, never the one that was on its new day, and a saved mock no run's mock continues
// gives its credits to no other.
describe(matchSavedMocks, () => {
  it("continues a moved mock as its plan saved it on its new day", () => {
    const moved = savedMock("2020-10-12", 2, 20);

    const matches = matchSavedMocks({
      dates: ["2020-10-12"],
      moves: [{ from: "2020-10-09", to: "2020-10-12" }],
      saved: [moved],
      start: "2020-10-05",
    });

    expect(matches.get("2020-10-12")).toBe(moved);
  });

  it("continues the mock the learner moved, not the one its new day held, and credits that one to none", () => {
    const source = savedMock("2020-10-09", 1, 20);
    const native = savedMock("2020-10-12", 2, 30);

    const matches = matchSavedMocks({
      dates: ["2020-10-12", "2020-10-19"],
      moves: [{ from: "2020-10-09", to: "2020-10-12" }],
      saved: [source, native],
      start: "2020-10-05",
    });

    expect(matches.get("2020-10-12")).toBe(source);
    expect(matches.has("2020-10-19")).toBe(false);
  });

  it("continues one of two mocks moved to the same day, the earliest, and credits the other to none", () => {
    const first = savedMock("2020-10-08", 1, 20);
    const second = savedMock("2020-10-09", 2, 30);

    const matches = matchSavedMocks({
      dates: ["2020-10-12", "2020-10-19"],
      moves: [
        { from: "2020-10-09", to: "2020-10-12" },
        { from: "2020-10-08", to: "2020-10-12" },
      ],
      saved: [first, second],
      start: "2020-10-05",
    });

    expect(matches.get("2020-10-12")).toBe(first);
    expect(matches.has("2020-10-19")).toBe(false);
  });
});

/** A day whose weekly mock replaces its review: the 12th sits exam day 2, the others day 1. */
function weeklyMockDay(date: string) {
  return {
    events: [
      {
        key: `mock:${date}`,
        kind: "mock" as const,
        minutes: 165,
        mock: { day: date === "2020-10-12" ? 2 : 1, fullLength: false },
        replacesDay: true,
        title: "",
      },
    ],
    minutes: 30,
    open: true,
    phase: 0,
    share: 0.6,
  };
}

// A day holds one weekly event: the learner's moved one, the earliest when two came to it.
describe("a weekly event moved onto a day that has one", () => {
  it("leaves the day one weekly event, the one the learner moved", () => {
    const describeDay = withMovedEvents({
      describeDay: (date) => weeklyMockDay(toIsoDate(date)),
      moves: [
        { from: "2020-10-09", to: "2020-10-12" },
        { from: "2020-10-08", to: "2020-10-12" },
      ],
    });

    const events = describeDay(fromIsoDate("2020-10-12")).events;

    expect(events.map((event) => [event.key, event.mock?.day])).toStrictEqual([
      ["mock:2020-10-12", 1],
    ]);
  });
});

/** A plan whose earlier run moved the 9th's mock to the 12th, with the learner's `moves`. */
function buildRelocated(moves: MovedEvent[]) {
  const input = examInput({ lessons: 200, moves, targetDate: fromIsoDate("2020-11-04") });

  return buildPlan({
    ...input,
    settings: { ...input.settings, mockRelocations: [{ from: "2020-10-09", to: "2020-10-12" }] },
  });
}

/** A built plan's mocks: their days and minutes. */
function listMocks(built: ReturnType<typeof buildPlan>) {
  return built.items.flatMap((item) =>
    item.kind === "mock" && item.scheduledFor
      ? [[toIsoDate(item.scheduledFor), item.minutes] as const]
      : [],
  );
}

// A mock an earlier run moved off a checkpoint's day (`mockRelocations`) stays on its new day, as
// announced, and the learner moves it from there; undoing their move brings it back there.
describe("a mock the plan moved off its checkpoint's day", () => {
  it("stays on its new day, its half day's length kept", () => {
    const built = buildRelocated([]);

    expect(listMocks(built)).toContainEqual(["2020-10-12", 165]);
    expect(listMocks(built).map(([date]) => date)).not.toContain("2020-10-09");
    expect(built.mocks.relocations).toStrictEqual([{ from: "2020-10-09", to: "2020-10-12" }]);
  });

  it("moves from its new day as the learner moves it, and back when they undo", () => {
    const moved = buildRelocated([{ from: "2020-10-12", to: "2020-10-13" }]);
    const dates = listMocks(moved).map(([date]) => date);

    expect(listMocks(moved)).toContainEqual(["2020-10-13", 165]);
    expect(dates).not.toContain("2020-10-12");
    expect(dates).not.toContain("2020-10-09");
    expect(listMocks(buildRelocated([]))).toContainEqual(["2020-10-12", 165]);
  });
});
