import { describe, expect, it, vi } from "vitest";
import { MAX_PLAN_DAYS } from "../target-date-range";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate } from "./plan-calendar";
import { parsePlanSettings } from "./plan-state";
import type * as MockDay from "./mock-day";
import type * as Calendar from "./plan-calendar";

/** How many days a build labeled (every read of a day's ISO date), and looked for a mock on. */
const labels = vi.hoisted(() => ({ count: 0 }));
const visits = vi.hoisted(() => ({ count: 0 }));

vi.mock("./mock-day", async (importOriginal) => {
  const actual = await importOriginal<typeof MockDay>();

  return {
    ...actual,
    findDayMock: (...args: Parameters<typeof actual.findDayMock>) => {
      visits.count += 1;
      return actual.findDayMock(...args);
    },
  };
});

vi.mock("./plan-calendar", async (importOriginal) => {
  const actual = await importOriginal<typeof Calendar>();

  return {
    ...actual,
    toIsoDate: (date: Date) => {
      labels.count += 1;
      return actual.toIsoDate(date);
    },
  };
});

/** An exam without a date: its plan runs `MAX_PLAN_DAYS`, a weekly mock in each of its weeks. */
function undatedExam(): BuildPlanInput {
  return {
    goal: { dailyMinutes: 45, kind: "exam", targetDate: null },
    graph: {
      phases: [{ milestone: null, name: "Everything" }],
      skills: [
        { area: "Math", lessons: 400, name: "Math", phase: 0, skillId: "math", weight: 5 },
        { area: "Law", lessons: 2000, name: "Law", phase: 0, skillId: "law", weight: 1 },
      ],
    },
    items: [],
    lessons: Array.from({ length: 400 }, (_, index) => ({
      chapterId: "chapter",
      lessonId: `math${index}`,
      minutes: 3,
      skillIds: ["math"],
      title: `Math ${index}`,
    })),
    mockMinutes: 45,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({
      startDate: "2026-09-28",
      weekdayMinutes: [0, 45, 45, 45, 45, 45, 45],
    }),
    today: fromIsoDate("2026-09-28"),
  };
}

// An undated exam's plan has a weekly mock for ten years of days: funding each mock read every day
// after its window, and a Today read spent four seconds on it.
describe("funding an undated exam's weekly mocks", () => {
  it("reads each day a number of times that doesn't grow with its mocks", () => {
    buildPlan(undatedExam());
    labels.count = 0;
    visits.count = 0;

    buildPlan(undatedExam());

    // About seven reads a day; funding each mock to the plan's end read over a million.
    expect(labels.count).toBeLessThan(MAX_PLAN_DAYS * 15);
    expect(visits.count).toBeLessThan(MAX_PLAN_DAYS * 15);
  });
});
