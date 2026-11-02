import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { findMockFundingOn, fundMocks, getFundedMinutes } from "./mock-funding";
import {
  type StudyCalendar,
  addDays,
  daysBetween,
  fromIsoDate,
  getStudyMinutes,
  toIsoDate,
} from "./plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "./plan-days";
import { type MovedEvent, type PlanGraph, parsePlanSettings } from "./plan-state";
import { type DayShape, type PlanDay, type ScheduledEvent } from "./schedule-units";
import { fundSpareMocks } from "./spare-mock-funding";

const MONDAY = fromIsoDate("2020-09-28");

function weekdays(minutes: number): StudyCalendar {
  return {
    dailyMinutes: minutes,
    firstDay: null,
    lightWeeks: [],
    weekdayMinutes: [0, minutes, minutes, minutes, minutes, minutes, 0],
  };
}

function describeDays({
  calendar,
  mocks,
}: {
  calendar: StudyCalendar;
  mocks: Record<string, number>;
}) {
  return (date: Date): DayShape => {
    const day = date.toISOString().slice(0, 10);
    const mock = mocks[day];

    return {
      events:
        mock === undefined
          ? []
          : [{ key: `mock:${day}`, kind: "mock", minutes: mock, replacesDay: true, title: "" }],
      minutes: getStudyMinutes({ calendar, date }),
      open: true,
      phase: 0,
      share: 0.6,
    };
  };
}

function listDays({
  describeDay,
  length,
  start = MONDAY,
}: {
  describeDay: (date: Date) => DayShape;
  length: number;
  start?: Date;
}): PlanDay[] {
  return Array.from({ length }, (_, offset) => {
    const date = addDays(start, offset);
    return { date, shape: describeDay(date) };
  });
}

function fund({
  calendar,
  funding = [],
  length,
  mocks,
  moves = [],
  start,
}: {
  calendar: StudyCalendar;
  funding?: Parameters<typeof fundMocks>[0]["funding"];
  length: number;
  mocks: Record<string, number>;
  moves?: MovedEvent[];
  start?: Date;
}) {
  const describeDay = describeDays({ calendar, mocks });
  return fundMocks({ days: listDays({ describeDay, length, start }), funding, moves });
}

function todayMinutes({
  calendar,
  date,
  funding,
}: {
  calendar: StudyCalendar;
  date: Date;
  funding: ReturnType<typeof fundMocks>["funding"];
}) {
  const settings = parsePlanSettings({ mockFunding: funding });

  return getPlannedMinutes({
    calendar,
    date,
    exam: getExamDayRules({ isExam: true, settings }),
    targetDate: null,
  });
}

function sumMinutes(days: readonly PlanDay[]) {
  return days.reduce((sum, day) => sum + day.shape.minutes, 0);
}

function contributions(dates: string[], minutes: number) {
  return dates.map((date) => ({ date, minutes }));
}

const FIRST_TWO_WEEKS = [
  "2020-09-28",
  "2020-09-29",
  "2020-09-30",
  "2020-10-01",
  "2020-10-02",
  "2020-10-05",
  "2020-10-06",
  "2020-10-07",
  "2020-10-08",
];

describe(fundMocks, () => {
  it("funds a weekly mock at its real length from the study days before it", () => {
    const calendar = weekdays(30);
    const funded = fund({ calendar, length: 12, mocks: { "2020-10-09": 165 } });

    expect(funded.funding).toStrictEqual([
      { contributions: contributions(FIRST_TWO_WEEKS, 15), date: "2020-10-09", minutes: 165 },
    ]);

    expect(funded.days.map((day) => day.shape.minutes)).toStrictEqual([
      15, 15, 15, 15, 15, 0, 0, 15, 15, 15, 15, 165,
    ]);

    expect(sumMinutes(funded.days)).toBe(30 * 10);

    expect(
      funded.days.map((day) => todayMinutes({ calendar, date: day.date, funding: funded.funding })),
    ).toStrictEqual(funded.days.map((day) => day.shape.minutes));

    expect(findMockFundingOn({ date: MONDAY, funding: funded.funding })).toStrictEqual({
      mockDate: "2020-10-09",
      mockMinutes: 165,
      setAsideMinutes: 15,
    });
  });

  it("funds the final stretch's whole exam day the same way, its reviews shorter", () => {
    const calendar = weekdays(60);
    const describeDay = describeDays({ calendar, mocks: { "2020-10-09": 330 } });

    const withReviews = (date: Date): DayShape => {
      const shape = describeDay(date);

      const review = {
        key: "review",
        kind: "review",
        minutes: shape.minutes,
        replacesDay: false,
        title: "",
      } as const;

      return shape.events.length > 0 ? shape : { ...shape, events: [review] };
    };

    const funded = fundMocks({
      days: listDays({ describeDay: withReviews, length: 12 }),
      funding: [],
      moves: [],
    });

    expect(funded.funding[0]?.minutes).toBe(330);
    expect(funded.days[0]?.shape).toMatchObject({ events: [{ minutes: 30 }], minutes: 30 });
    expect(sumMinutes(funded.days)).toBe(60 * 10);
  });

  it("keeps a checkpoint's time on a day that funds a mock", () => {
    const calendar = weekdays(30);
    const describeDay = describeDays({ calendar, mocks: { "2020-10-09": 165 } });
    const checkpointDay = "2020-10-08";

    const withCheckpoint = (date: Date): DayShape => {
      const shape = describeDay(date);

      const boss = {
        key: "boss:0",
        kind: "boss",
        minutes: 10,
        replacesDay: false,
        title: "",
      } as const;

      return date.toISOString().startsWith(checkpointDay) ? { ...shape, events: [boss] } : shape;
    };

    const funded = fundMocks({
      days: listDays({ describeDay: withCheckpoint, length: 12 }),
      funding: [],
      moves: [],
    });

    const share = 135 / (8 * 30 + 20);
    const given = funded.funding[0]?.contributions.find((entry) => entry.date === checkpointDay);

    expect(given?.minutes).toBeCloseTo(20 * share);

    expect(funded.days[10]?.shape.events).toStrictEqual([
      { key: "boss:0", kind: "boss", minutes: 10, replacesDay: false, title: "" },
    ]);

    expect(funded.days[10]?.shape.minutes).toBeCloseTo(10 + 20 * (1 - share));
    expect(sumMinutes(funded.days)).toBeCloseTo(30 * 10);
  });

  it("leaves out a mock its window can't fund, squeezing no day, and funds the next from both", () => {
    const calendar = weekdays(15);

    const funded = fund({ calendar, length: 26, mocks: { "2020-10-09": 165, "2020-10-23": 165 } });

    expect(funded.days[11]?.shape.events).toStrictEqual([]);
    expect(funded.funding.map((entry) => entry.date)).toStrictEqual(["2020-10-23"]);

    expect(sumMinutes(funded.days)).toBeCloseTo(15 * 20);
    expect(funded.days[11]?.shape.minutes).toBeCloseTo(15 - 150 / 19);
  });

  it("credits what past days set aside as they saved it, so a later run keeps the same days", () => {
    const calendar = weekdays(30);
    const first = fund({ calendar, length: 12, mocks: { "2020-10-09": 165 } });

    const later = fund({
      calendar,
      funding: first.funding,
      length: 5,
      mocks: { "2020-10-09": 165 },
      start: fromIsoDate("2020-10-05"),
    });

    expect(later.funding).toStrictEqual(first.funding);
    expect(later.days.map((day) => day.shape.minutes)).toStrictEqual([15, 15, 15, 15, 165]);
  });

  it("never counts past days at a new pace", () => {
    const first = fund({ calendar: weekdays(15), length: 26, mocks: { "2020-10-23": 165 } });

    const pastWeek =
      first.funding[0]?.contributions.filter((given) => given.date < "2020-10-05") ?? [];

    const later = fund({
      calendar: weekdays(60),
      funding: first.funding,
      length: 19,
      mocks: { "2020-10-23": 165 },
      start: fromIsoDate("2020-10-05"),
    });

    const saved = later.funding[0]?.contributions ?? [];
    expect(saved.filter((given) => given.date < "2020-10-05")).toStrictEqual(pastWeek);

    const setAside = pastWeek.reduce((sum, given) => sum + given.minutes, 0);
    const future = saved.filter((given) => given.date >= "2020-10-05");
    expect(future.reduce((sum, given) => sum + given.minutes, 0)).toBeCloseTo(105 - setAside);
  });

  it("keeps a moved mock's funding, crediting its days before the move", () => {
    const calendar = weekdays(30);
    const first = fund({ calendar, length: 12, mocks: { "2020-10-09": 165 } });

    const moved = fund({
      calendar,
      funding: first.funding,
      length: 8,
      mocks: { "2020-10-12": 165 },
      moves: [{ from: "2020-10-09", to: "2020-10-12" }],
      start: fromIsoDate("2020-10-05"),
    });

    expect(moved.funding.map((entry) => entry.date)).toStrictEqual(["2020-10-12"]);

    expect(moved.days.map((day) => day.shape.minutes)).toStrictEqual([
      18, 18, 18, 18, 18, 0, 0, 165,
    ]);
  });
});

function finalEvent(date: Date, kind: "mock" | "review", minutes: number): ScheduledEvent {
  return {
    date,
    key: `${kind}:${date.toISOString().slice(0, 10)}`,
    kind,
    minutes,
    phase: 1,
    replacesDay: kind === "mock",
    title: "",
  };
}

function finalStretch({
  minutes,
  mock,
  reviews,
}: {
  minutes: number;
  mock: number;
  reviews: number;
}) {
  const dates = Array.from({ length: reviews + 2 }, (_, offset) => addDays(MONDAY, offset));

  const days: PlanDay[] = dates.map((date, index) => ({
    date,
    shape: { events: [], minutes, open: index === 0, phase: 1, share: 1 },
  }));

  const last = dates.at(-1) ?? MONDAY;

  const events = [
    ...dates.slice(1, -1).map((date) => finalEvent(date, "review", minutes)),
    finalEvent(last, "mock", mock),
  ];

  return { days, events, last };
}

describe(fundSpareMocks, () => {
  it("funds a spare whole-day mock from the review days before it, never from a lesson day", () => {
    const { days, events, last } = finalStretch({ minutes: 60, mock: 330, reviews: 9 });

    const funded = fundSpareMocks({ days, events, funded: [], saved: [], start: MONDAY });

    expect(funded.funding).toStrictEqual([
      {
        contributions: events
          .slice(0, -1)
          .map((item) => ({ date: item.date.toISOString().slice(0, 10), minutes: 30 })),
        date: last.toISOString().slice(0, 10),
        day: null,
        fullLength: true,
        minutes: 330,
      },
    ]);

    expect(funded.events.map((item) => [item.kind, item.minutes])).toStrictEqual([
      ...Array.from({ length: 9 }, () => ["review", 30]),
      ["mock", 330],
    ]);

    const calendar = { dailyMinutes: 60, firstDay: null, lightWeeks: [], weekdayMinutes: null };

    expect(
      funded.events.map((item) =>
        todayMinutes({ calendar, date: item.date, funding: funded.funding }),
      ),
    ).toStrictEqual(funded.events.map((item) => item.minutes));
  });

  it("keeps a spare mock its review days can't fund as the review it was", () => {
    const { days, events, last } = finalStretch({ minutes: 30, mock: 330, reviews: 9 });

    const funded = fundSpareMocks({ days, events, funded: [], saved: [], start: MONDAY });

    expect(funded.funding).toStrictEqual([]);
    expect(funded.events.at(-1)).toMatchObject({ date: last, kind: "review", minutes: 30 });
    expect(funded.events.slice(0, -1).every((item) => item.minutes === 30)).toBe(true);
  });

  it("sets nothing aside for a spare mock its own day holds", () => {
    const { days, events } = finalStretch({ minutes: 480, mock: 480, reviews: 3 });

    const funded = fundSpareMocks({ days, events, funded: [], saved: [], start: MONDAY });

    expect(funded.funding).toStrictEqual([
      { contributions: [], date: "2020-10-02", day: null, fullLength: true, minutes: 480 },
    ]);

    expect(funded.events).toStrictEqual(
      events.map((item) =>
        item.kind === "mock" ? { ...item, mock: { day: null, fullLength: true } } : item,
      ),
    );
  });
});

function earlyFinishedPlan() {
  const graph: PlanGraph = {
    phases: [{ milestone: null, name: "Base" }],
    skills: ["Linguagens", "Matemática"].map((area) => ({
      area,
      lessons: 6,
      name: area,
      phase: 0,
      skillId: area,
      weight: 1,
    })),
  };

  const input: BuildPlanInput = {
    fullMockMinutes: 330,
    goal: { dailyMinutes: 330, kind: "exam", targetDate: addDays(MONDAY, 112) },
    graph,
    items: [],
    lessons: graph.skills.flatMap((skill) =>
      Array.from({ length: 6 }, (_, index) => ({
        chapterId: `chapter-${skill.skillId}`,
        lessonId: `${skill.skillId}-${index}`,
        minutes: 5,
        skillIds: [skill.skillId],
        title: `${skill.name} ${index}`,
      })),
    ),
    mockMinutes: 165,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(MONDAY) }),
    today: MONDAY,
  };

  return { built: buildPlan(input), input };
}

describe("a plan whose lessons end early", () => {
  it("saves funding for every mock it plans, spare ones included, within the learner's time", () => {
    const { built, input } = earlyFinishedPlan();
    const calendar = { dailyMinutes: 330, firstDay: MONDAY, lightWeeks: [], weekdayMinutes: null };
    const mocks = built.items.filter((item) => item.kind === "mock" && item.scheduledFor);

    expect(mocks.filter((item) => item.minutes === 330).length).toBeGreaterThan(1);

    expect(
      mocks.map((item) => [toIsoDate(item.scheduledFor ?? MONDAY), item.minutes]),
    ).toStrictEqual(built.mockFunding.map((entry) => [entry.date, entry.minutes]));

    const settings = parsePlanSettings({ ...input.settings, mockFunding: built.mockFunding });
    const exam = getExamDayRules({ isExam: true, settings });
    const unfundedExam = getExamDayRules({ isExam: true, settings: input.settings });
    const targetDate = input.goal.targetDate;
    const length = targetDate ? daysBetween(MONDAY, targetDate) : 0;
    const dates = Array.from({ length }, (_, offset) => addDays(MONDAY, offset));

    const funded = dates.reduce(
      (total, date) => total + getPlannedMinutes({ calendar, date, exam, targetDate }),
      0,
    );

    const unfunded = dates.reduce(
      (total, date) =>
        total + getPlannedMinutes({ calendar, date, exam: unfundedExam, targetDate }),
      0,
    );

    expect(funded).toBeCloseTo(unfunded);

    const planned = built.items
      .filter((item) => item.scheduledFor && item.scheduledFor < (targetDate ?? MONDAY))
      .reduce((total, item) => total + item.minutes, 0);

    expect(planned).toBeLessThanOrEqual(unfunded + 0.1);
  });
});

describe("a plan that goes on after its exam", () => {
  it("saves the funding of the mocks after the exam too", () => {
    const graph: PlanGraph = {
      phases: [{ milestone: null, name: "Base" }],
      skills: [
        { area: "Linguagens", lessons: 120, name: "Linguagens", phase: 0, skillId: "L", weight: 1 },
      ],
    };

    const targetDate = addDays(MONDAY, 21);

    const built = buildPlan({
      goal: { dailyMinutes: 30, kind: "exam", targetDate },
      graph,
      items: [],
      lessons: Array.from({ length: 120 }, (_, index) => ({
        chapterId: "chapter-L",
        lessonId: `L-${index}`,
        minutes: 5,
        skillIds: ["L"],
        title: `Linguagens ${index}`,
      })),
      mockMinutes: 165,
      mode: "forced",
      paceFactor: 1,
      prerequisites: new Map(),
      readiness: new Map(),
      settings: parsePlanSettings({ fullCourse: true, startDate: toIsoDate(MONDAY) }),
      today: MONDAY,
    });

    const after = built.items.filter(
      (item) => item.kind === "mock" && item.scheduledFor && item.scheduledFor > targetDate,
    );

    expect(after.length).toBeGreaterThan(0);

    expect(
      after.map((item) => {
        const entry = built.mockFunding.find(
          (saved) => saved.date === toIsoDate(item.scheduledFor ?? MONDAY),
        );

        return [item.minutes, entry?.minutes, (entry?.contributions.length ?? 0) > 0];
      }),
    ).toStrictEqual(after.map(() => [165, 165, true]));
  });
});

describe(getFundedMinutes, () => {
  const date = fromIsoDate("2020-10-16");

  function funding(given: readonly number[]) {
    const setAside = given.map((minutes, offset) => ({
      date: toIsoDate(addDays(date, offset - given.length)),
      minutes,
    }));

    return [{ contributions: setAside, date: "2020-10-16", fullLength: false, minutes: 165 }];
  }

  it("gives a fully funded mock's day its whole time", () => {
    const given = Array.from({ length: 14 }, () => 135 / 14);
    expect(getFundedMinutes({ base: 30, date, funding: funding(given) })).toBe(165);
  });

  it("gives a day its mock's days funded only partly no more than they set aside", () => {
    expect(getFundedMinutes({ base: 30, date, funding: funding([60, 40]) })).toBe(130);
  });
});
