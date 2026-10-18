import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraph, parsePlanSettings } from "./plan-state";

/** A Monday. */
const TODAY = new Date("2026-10-12T00:00:00Z");

/** Câmara's mocks: half its first day on regular weeks, the whole day with its written test. */
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
    // A study day that holds the whole exam day, so a mock comes every week (see `getMockWeeks`).
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

/** Each mock's minutes, by whether it falls in the final stretch. */
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
  // The final stretch's mock asks the whole exam day, Câmara's written test included (480
  // minutes), but its day kept the regular weeks' 150, so the plan showed the day a third full.
  it("reserves the real exam day's time for a final-stretch mock", () => {
    const { final, regular } = listMockMinutes(examPlan({ daysAway: 70, lessons: 120 }));

    expect(final.length).toBeGreaterThan(0);
    expect(regular.length).toBeGreaterThan(0);
    expect(new Set(final)).toStrictEqual(new Set([FULL_MOCK_MINUTES]));
    expect(new Set(regular)).toStrictEqual(new Set([WEEKLY_MOCK_MINUTES]));
  });

  // A plan whose lessons end weeks early spends each spare week on one more mock in its final
  // stretch: a full one too.
  it("reserves the real exam day's time for the final stretch's spare mocks", () => {
    const { final } = listMockMinutes(examPlan({ daysAway: 70, lessons: 10 }));

    expect(final.length).toBeGreaterThan(1);
    expect(new Set(final)).toStrictEqual(new Set([FULL_MOCK_MINUTES]));
  });
});
