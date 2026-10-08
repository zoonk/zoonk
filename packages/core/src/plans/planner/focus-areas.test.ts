import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

/** A Monday. */
const TODAY = fromIsoDate("2026-09-28");

function skill(skillId: string, attrs: Partial<PlanGraphSkill>): PlanGraphSkill {
  return { area: null, lessons: 1, name: skillId, phase: 0, skillId, weight: null, ...attrs };
}

function lessonsFor(skillId: string, count: number): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterId: "chapter",
    lessonId: `${skillId}-${index + 1}`,
    minutes: 3,
    skillIds: [skillId],
    title: `${skillId} ${index + 1}`,
  }));
}

/** Three areas in phase order, and too little time before the date for all of them. */
function shortPlan(focusAreas: string[]): BuildPlanInput {
  return {
    goal: { dailyMinutes: 12, kind: "learn", targetDate: fromIsoDate("2026-10-08") },
    graph: {
      phases: [
        { milestone: null, name: "Research" },
        { milestone: null, name: "Design" },
        { milestone: null, name: "Projects" },
      ],
      skills: [
        skill("research", { area: "Research", lessons: 8 }),
        skill("design", { area: "Design", lessons: 8, phase: 1 }),
        skill("projects", { area: "Projects", lessons: 4, phase: 2 }),
      ],
    },
    items: [],
    lessons: [
      ...lessonsFor("research", 8),
      ...lessonsFor("design", 8),
      ...lessonsFor("projects", 4),
    ],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ focusAreas, startDate: "2026-09-28" }),
    today: TODAY,
  };
}

function plannedLessons(input: BuildPlanInput): string[] {
  return buildPlan(input).items.flatMap((item) => (item.lessonId ? [item.lessonId] : []));
}

/** The lessons of the two areas the second test focuses on. */
function countPicked(lessons: readonly string[]): number {
  return lessons.filter((id) => id.startsWith("research") || id.startsWith("design")).length;
}

describe("focusing on an area of a plan short on time", () => {
  it("gives a focused area its depth, leaving other depth out instead", () => {
    const unfocused = plannedLessons(shortPlan([]));
    const focused = plannedLessons(shortPlan(["Projects"]));

    // Short on time, every area keeps its core and some of its depth (Projects, last in the path,
    // isn't the one left without any); the focus brings the rest of Projects in.
    expect(unfocused.filter((id) => id.startsWith("projects"))).toHaveLength(3);
    expect(focused.filter((id) => id.startsWith("projects"))).toHaveLength(4);
    expect(focused.length).toBeLessThanOrEqual(unfocused.length + 1);
  });

  /*
   * The focus sheet and the focus test promise every other topic stays in the plan. A focused area
   * used to count as all core, so a big one pushed the other areas' cores out of a short plan.
   */
  it("keeps every other area's core when a big area gets the focus", () => {
    const focused = plannedLessons(shortPlan(["Research", "Design"]));
    const areas = ["research", "design", "projects"];

    expect(areas.filter((area) => focused.some((id) => id.startsWith(area)))).toStrictEqual(areas);

    // The focus still goes deeper in the areas picked than the plan without it.
    const unfocused = plannedLessons(shortPlan([]));

    expect(countPicked(focused)).toBeGreaterThanOrEqual(countPicked(unfocused));
  });
});

/** An exam whose subjects start in phases: Portuguese and Math first, Law in the last phase. */
function examPlan(settings: object): BuildPlanInput {
  return {
    goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-12-20") },
    graph: {
      phases: [
        { milestone: null, name: "Basics" },
        { milestone: null, name: "Core" },
        { milestone: null, name: "Practice" },
      ],
      skills: [
        skill("pt-basics", { area: "Portuguese", lessons: 6 }),
        skill("math", { area: "Math", lessons: 20 }),
        skill("pt-texts", { area: "Portuguese", lessons: 6, phase: 1 }),
        skill("law", { area: "Law", lessons: 6, phase: 2 }),
      ],
    },
    items: [],
    lessons: [
      ...lessonsFor("pt-basics", 6),
      ...lessonsFor("math", 20),
      ...lessonsFor("pt-texts", 6),
      ...lessonsFor("law", 6),
    ],
    mockMinutes: 60,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2026-09-28", ...settings }),
    today: TODAY,
  };
}

/** The day a skill's first lesson is planned, or null when the plan leaves it out. */
function firstDay(input: BuildPlanInput, skillId: string): string | null {
  const days = buildPlan(input)
    .items.filter((item) => item.lessonId?.startsWith(skillId) && item.scheduledFor)
    .map((item) => toIsoDate(item.scheduledFor ?? TODAY))
    .toSorted();

  return days[0] ?? null;
}

describe("an exam's subject the learner focused on", () => {
  it("joins the study cycle from the start instead of over the first weeks", () => {
    const unfocused = firstDay(examPlan({}), "law") ?? "";
    const focused = firstDay(examPlan({ focusAreas: ["Law"] }), "law") ?? "";

    // Two subjects a day: the focused one, worth most to the learner now, opens the cycle.
    expect(focused).toBe("2026-09-28");
    expect(fromIsoDate(unfocused).getTime()).toBeGreaterThan(fromIsoDate(focused).getTime());
  });
});

describe("a subject the learner is past the basics of", () => {
  it("starts past its foundations and keeps what builds on them", () => {
    const input = examPlan({ pastBasicsAreas: ["Portuguese"] });

    expect(firstDay(input, "pt-basics")).toBeNull();
    expect(firstDay(input, "pt-texts")).not.toBeNull();
    expect(firstDay(input, "law")).not.toBeNull();
  });
});

/** The lessons of one area a plan keeps. */
function countArea(lessons: readonly string[], skillId: string): number {
  return lessons.filter((id) => id.startsWith(skillId)).length;
}

describe("an area the learner wants less of", () => {
  it("gives it less of a plan short on time and the others more, keeping its core", () => {
    const usual = plannedLessons(shortPlan([]));

    const reduced = plannedLessons({
      ...shortPlan([]),
      settings: parsePlanSettings({ reducedAreas: ["Research"], startDate: "2026-09-28" }),
    });

    expect(countArea(reduced, "research")).toBeLessThan(countArea(usual, "research"));
    expect(countArea(reduced, "research")).toBeGreaterThanOrEqual(1);

    expect(countArea(reduced, "design") + countArea(reduced, "projects")).toBeGreaterThan(
      countArea(usual, "design") + countArea(usual, "projects"),
    );
  });

  it("gives an exam's subject fewer of its lessons when time is short", () => {
    const short = {
      dailyMinutes: 10,
      kind: "exam" as const,
      targetDate: fromIsoDate("2026-10-20"),
    };

    const usual = plannedLessons({ ...examPlan({}), goal: short });
    const reduced = plannedLessons({ ...examPlan({ reducedAreas: ["Math"] }), goal: short });

    expect(countArea(reduced, "math")).toBeLessThan(countArea(usual, "math"));
    expect(countArea(reduced, "law")).toBeGreaterThanOrEqual(countArea(usual, "law"));
  });
});
