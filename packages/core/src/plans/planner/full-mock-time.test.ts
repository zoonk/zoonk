import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraph, parsePlanSettings } from "./plan-state";

const TODAY = new Date("2026-10-12T00:00:00Z");

const WEEKLY_MOCK_MINUTES = 150;
const FULL_MOCK_MINUTES = 480;

function examGraph(lessons: number): PlanGraph {
  return {
    phases: [{ milestone: null, name: "Base" }],
    skills: ["Portuguese", "Law"].map((area) => ({
      area,
      lessons,
      name: area,
      phase: 0,
      skillId: area,
      weight: 1,
    })),
  };
}

function examPlan({ daysAway, lessons }: { daysAway: number; lessons: number }) {
  const graph = examGraph(lessons);

  const input: BuildPlanInput = {
    fullMockMinutes: FULL_MOCK_MINUTES,
    goal: { dailyMinutes: FULL_MOCK_MINUTES, kind: "exam", targetDate: addDays(TODAY, daysAway) },
    graph,
    items: [],
    lessons: graph.skills.flatMap((skill) =>
      Array.from({ length: lessons }, (_, index) => ({
        chapterId: `chapter-${skill.skillId}`,
        lessonId: `${skill.skillId}-${index}`,
        minutes: 5,
        skillIds: [skill.skillId],
        title: `${skill.name} ${index}`,
      })),
    ),
    mockMinutes: WEEKLY_MOCK_MINUTES,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };

  return buildPlan(input);
}

function listMockMinutes(plan: ReturnType<typeof examPlan>) {
  const start = plan.phases.find((phase) => phase.kind === "finalStretch")?.startDate;
  const finalStretch = start ? fromIsoDate(start) : null;

  const mocks = plan.items.filter((item) => item.kind === "mock" && item.scheduledFor);

  const isFinal = (date: Date | null) =>
    Boolean(finalStretch && date && date.getTime() >= finalStretch.getTime());

  return {
    final: mocks.filter((item) => isFinal(item.scheduledFor)).map((item) => item.minutes),
    regular: mocks.filter((item) => !isFinal(item.scheduledFor)).map((item) => item.minutes),
  };
}

describe("an exam plan's full mocks", () => {
  it("reserves the real exam day's time for a final-stretch mock", () => {
    const { final, regular } = listMockMinutes(examPlan({ daysAway: 70, lessons: 120 }));

    expect(final.length).toBeGreaterThan(0);
    expect(regular.length).toBeGreaterThan(0);
    expect(new Set(final)).toStrictEqual(new Set([FULL_MOCK_MINUTES]));
    expect(new Set(regular)).toStrictEqual(new Set([WEEKLY_MOCK_MINUTES]));
  });

  it("reserves the real exam day's time for the final stretch's spare mocks", () => {
    const { final } = listMockMinutes(examPlan({ daysAway: 70, lessons: 10 }));

    expect(final.length).toBeGreaterThan(1);
    expect(new Set(final)).toStrictEqual(new Set([FULL_MOCK_MINUTES]));
  });
});
