import { describe, expect, it } from "vitest";
import { type BuildPlanInput } from "./build-plan";
import { findFittingMinutes, withDailyMinutes } from "./daily-time-plans";
import { getPlanFeasibility } from "./plan-feasibility";
import { applyPlanOperations } from "./plan-operations";
import { type PlanState, parsePlanSettings } from "./plan-state";
import { getScheduleOperations } from "./schedule-operations";

const today = new Date("2020-09-28T00:00:00Z");

const state: PlanState = {
  goal: { dailyMinutes: 60, targetDate: "2020-10-01" },
  graph: {
    phases: [{ milestone: null, name: "Everything" }],
    skills: [{ area: null, lessons: 16, name: "One", phase: 0, skillId: "s1", weight: null }],
  },
  settings: parsePlanSettings({
    startDate: "2020-09-28",
    weekdayMinutes: [30, 60, 30, 60, 60, 60, 30],
  }),
};

function stateAt(dailyMinutes: number) {
  const result = applyPlanOperations({
    goalKind: "learn",
    operations: getScheduleOperations({
      input: { dailyMinutes, studyDays: [0, 2, 3, 4, 6], weekendMinutes: 30 },
      state,
    }),
    state,
    today,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  return result.state;
}

function scheduleAt(dailyMinutes: number) {
  const saved = stateAt(dailyMinutes);
  return { dailyMinutes: saved.goal.dailyMinutes, weekdayMinutes: saved.settings.weekdayMinutes };
}

function inputAt(dailyMinutes: number): BuildPlanInput {
  const saved = stateAt(dailyMinutes);

  return {
    goal: {
      dailyMinutes: saved.goal.dailyMinutes,
      kind: "learn",
      targetDate: new Date("2020-10-01T00:00:00Z"),
    },
    graph: state.graph,
    items: [],
    lessons: [],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: saved.settings,
    today,
  };
}

const EXAM_CASES = [60, 69, 150].flatMap((mockMinutes) =>
  [1, 2, 10, 14, 24].flatMap((lessons) =>
    [[0], [0, 6], [1, 3, 5]].map((studyDays) => ({ lessons, mockMinutes, studyDays })),
  ),
);

function examStateAt({
  dailyMinutes,
  state: original,
  studyDays,
}: {
  dailyMinutes: number;
  state: PlanState;
  studyDays: number[];
}) {
  const result = applyPlanOperations({
    goalKind: "exam",
    operations: getScheduleOperations({ input: { dailyMinutes, studyDays }, state: original }),
    state: original,
    today,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  return result.state;
}

/** An independent oracle builds every candidate, without reading a recommendation. */
function exhaustiveMinimum(inputFor: (minutes: number) => BuildPlanInput): number | null {
  const candidates = Array.from({ length: 48 }, (_, index) => (index + 1) * 5);

  const observations = candidates.map((minutes) => ({
    fits: getPlanFeasibility({ input: inputFor(minutes) }).fits,
    minutes,
  }));

  return observations.find((candidate) => candidate.fits)?.minutes ?? null;
}

describe("accepted daily-time candidates", () => {
  it.each(EXAM_CASES)(
    "matches the exhaustive exam planner for $lessons lessons, $mockMinutes mock minutes, days $studyDays",
    ({ lessons, mockMinutes, studyDays }) => {
      const original: PlanState = {
        ...state,
        goal: { dailyMinutes: 60, targetDate: "2020-10-16" },
        graph: {
          ...state.graph,
          skills: [{ area: "Math", lessons, name: "Math", phase: 0, skillId: "s1", weight: 1 }],
        },
        settings: parsePlanSettings({ startDate: "2020-09-28" }),
      };

      const acceptedAt = (dailyMinutes: number) =>
        examStateAt({ dailyMinutes, state: original, studyDays });

      const studyScheduleAt = (dailyMinutes: number) => {
        const saved = acceptedAt(dailyMinutes);

        return {
          dailyMinutes: saved.goal.dailyMinutes,
          weekdayMinutes: saved.settings.weekdayMinutes,
        };
      };

      const examInputAt = (dailyMinutes: number): BuildPlanInput => {
        const saved = acceptedAt(dailyMinutes);

        return {
          ...inputAt(60),
          goal: {
            dailyMinutes: saved.goal.dailyMinutes,
            kind: "exam",
            targetDate: new Date("2020-10-16T00:00:00Z"),
          },
          graph: original.graph,
          mockMinutes,
          settings: saved.settings,
        };
      };

      const expected = exhaustiveMinimum(examInputAt);
      const advice = getPlanFeasibility({ input: examInputAt(60), studyScheduleAt });
      expect(advice.recommendedMinutes).toBe(expected);

      /** A saved non-fitting higher time must still consider lower times before a new mock. */
      const saved = examInputAt(70);
      const savedExpected = exhaustiveMinimum((minutes) => withDailyMinutes(saved, minutes));
      expect(getPlanFeasibility({ input: saved }).recommendedMinutes).toBe(savedExpected);
    },
  );

  it("finds the least fitting input across a decrease in the normalized first-day budget", () => {
    expect(
      [50, 55, 60, 65].map((minutes) => getPlanFeasibility({ input: inputAt(minutes) }).fits),
    ).toStrictEqual([false, true, false, true]);

    expect(scheduleAt(55).dailyMinutes).toBe(55);
    expect(scheduleAt(60).dailyMinutes).toBe(30);

    const feasibility = getPlanFeasibility({ input: inputAt(5), studyScheduleAt: scheduleAt });
    expect(feasibility.recommendedMinutes).toBe(55);

    expect(getPlanFeasibility({ input: inputAt(feasibility.recommendedMinutes ?? 0) }).fits).toBe(
      true,
    );
  });
});

/** 300 minutes fit, 305 to 395 don't (a mock takes the day), and 400 on do. */
const fitsAroundAMock = (minutes: number) => minutes === 300 || minutes >= 400;

describe(findFittingMinutes, () => {
  it("takes the fewest time up to 4 hours, even when a longer one fits no more", () => {
    const tried: number[] = [];

    const found = findFittingMinutes((minutes) => {
      tried.push(minutes);
      return minutes === 95 || minutes >= 135;
    });

    expect(found).toBe(95);
    expect(tried).toStrictEqual(Array.from({ length: 19 }, (_, index) => (index + 1) * 5));
  });

  it("finds the exact time past 4 hours when more time always covers more", () => {
    expect(findFittingMinutes((minutes) => minutes >= 365)).toBe(365);
    expect(findFittingMinutes((minutes) => minutes >= 1440)).toBe(1440);
  });

  it("answers past 4 hours only with a time that fits, which may not be the fewest", () => {
    const found = findFittingMinutes(fitsAroundAMock);

    expect(found).toBe(400);
    expect(fitsAroundAMock(found ?? 0)).toBe(true);
  });

  it("finds nothing when not even a whole day fits", () => {
    expect(findFittingMinutes(() => false)).toBeNull();
  });
});
