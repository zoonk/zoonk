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
    overflow: built.checkpointOverflow,
    targetDate: input.goal.targetDate,
  });

  const items = built.items.filter(
    (item) => item.scheduledFor && toIsoDate(item.scheduledFor) === date,
  );

  return { budget, items, minutes: items.reduce((total, item) => total + item.minutes, 0) };
}

const BOSS = getCheckpointMinutes(CHECKPOINT_QUESTIONS);

describe("a mock moved onto a day that holds something", () => {
  it("replaces the review of a day in the final stretch", () => {
    const input = examInput({
      lessons: 60,
      moves: [{ from: "2020-10-09", to: "2020-10-12" }],
      targetDate: fromIsoDate("2020-10-14"),
    });

    const built = buildPlan(input);
    const day = readDay({ built, date: "2020-10-12", input });

    expect(day.items.map((item) => item.kind)).toContain("mock");
    expect(day.items.map((item) => item.kind)).not.toContain("review");
    expect(day.minutes).toBeCloseTo(day.budget);
  });

  it("keeps a phase checkpoint's time beside it", () => {
    const plain = buildPlan(examInput({ lessons: 200, targetDate: fromIsoDate("2020-11-04") }));

    const target = plain.items
      .flatMap((item) =>
        item.kind === "boss" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
      )
      .find((date) => date > "2020-10-09");

    if (!target) {
      throw new Error("Expected a phase checkpoint after the first mock");
    }

    const input = {
      ...examInput({
        lessons: 200,
        moves: [{ from: "2020-10-09", to: target }],
        targetDate: fromIsoDate("2020-11-04"),
      }),
      items: plain.items.map((item, position) => ({ ...item, id: item.key, position })),
    };

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

    expect(readDay({ built, date: "2020-10-05", input }).budget).toBe(30);
  });
});

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

    expect(
      dates.slice(0, -1).filter((date) => {
        const day = readDay({ built, date, input });
        return day.budget - day.minutes >= lesson;
      }),
    ).toStrictEqual([]);
  });
});

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

describe(resolvePlannedMocks, () => {
  const settled: PlannedMocks = { horizon: 2, mockFunding: [], next: null, unfundedMocks: [] };

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

function savedMock(date: string, day: number, given: number) {
  return {
    contributions: [{ date: "2020-10-01", minutes: given }],
    date,
    day,
    fullLength: false,
    minutes: 165,
  };
}

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
});

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

describe("a weekly event moved onto a day that has one", () => {
  it("leaves the day one weekly event, the one the learner moved", () => {
    const describeDay = withMovedEvents({
      describeDay: (date) => weeklyMockDay(toIsoDate(date)),
      moves: [{ from: "2020-10-09", to: "2020-10-12" }],
    });

    const events = describeDay(fromIsoDate("2020-10-12")).events;

    expect(events.map((event) => [event.key, event.mock?.day])).toStrictEqual([
      ["mock:2020-10-12", 1],
    ]);
  });
});
