import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

/** A Monday, half a year before the learner wants the new job. */
const TODAY = fromIsoDate("2026-09-28");

function skill(
  skillId: string,
  attrs: Pick<PlanGraphSkill, "area" | "phase"> & Partial<PlanGraphSkill>,
): PlanGraphSkill {
  return { lessons: 6, name: skillId, skillId, weight: null, ...attrs };
}

function lessonsFor(skillId: string, count: number): PlannerLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    chapterId: skillId,
    lessonId: `${skillId}-${index}`,
    minutes: 3,
    skillIds: [skillId],
    title: `${skillId} ${index + 1}`,
  }));
}

/**
 * A career change into UX: research, design and testing modules, then a portfolio project whose
 * steps each apply one module, then the job search, which needs the finished case study. The
 * skill graph puts the portfolio and the job search last, as their own phases.
 */
function careerInput({ outcome }: { outcome: boolean }): BuildPlanInput {
  const skills = [
    skill("research", { area: "Research", phase: 0 }),
    skill("interviews", { area: "Research", phase: 0 }),
    skill("flows", { area: "Design", phase: 1 }),
    skill("screens", { area: "Design", phase: 1 }),
    skill("testing", { area: "Testing", phase: 2 }),
    skill("case-scope", { area: "Portfolio", outcome, phase: 3 }),
    skill("case-design", { area: "Portfolio", outcome, phase: 3 }),
    skill("case-study", { area: "Portfolio", outcome, phase: 3 }),
    skill("resume", { area: "Job search", outcome, phase: 4 }),
  ];

  return {
    goal: { dailyMinutes: 20, kind: "learn", targetDate: fromIsoDate("2027-03-29") },
    graph: {
      phases: ["Research", "Design", "Testing", "Portfolio", "Job search"].map((name) => ({
        milestone: null,
        name,
      })),
      skills,
    },
    items: [],
    lessons: skills.flatMap((item) => lessonsFor(item.skillId, item.lessons)),
    mockMinutes: 0,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([
      ["interviews", ["research"]],
      ["screens", ["flows"]],
      ["case-scope", ["research"]],
      ["case-design", ["case-scope", "flows"]],
      ["case-study", ["case-design", "testing"]],
      ["resume", ["case-study"]],
    ]),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2026-09-28" }),
    today: TODAY,
  };
}

/** Each skill's first lesson's place among the plan's lessons. */
function firstPlaces(plan: ReturnType<typeof buildPlan>): Map<string, number> {
  const lessons = plan.items.filter((item) => item.kind === "lesson");

  return lessons.reduce(
    (places, item, index) =>
      item.skillId && !places.has(item.skillId) ? places.set(item.skillId, index) : places,
    new Map<string, number>(),
  );
}

describe("a career change whose goal needs a portfolio", () => {
  it("builds each portfolio piece as soon as the skills it applies are learned", () => {
    const plan = buildPlan(careerInput({ outcome: true }));
    const place = firstPlaces(plan);
    const at = (skillId: string) => place.get(skillId) ?? -1;

    // The project starts right after research, its design right after flows, its case study once
    // testing is done: never only after every module.
    expect(at("case-scope")).toBeLessThan(at("interviews"));
    expect(at("case-design")).toBeLessThan(at("screens"));
    expect(at("case-study")).toBeGreaterThan(at("testing"));
    expect(at("resume")).toBeGreaterThan(at("case-study"));

    // Phases still come one after another, each closed by its own challenge.
    const bosses = plan.items.filter((item) => item.kind === "boss").map((item) => item.phase);
    expect(bosses).toStrictEqual([...new Set(bosses)].toSorted((a, b) => a - b));
  });

  it("keeps the graph's order for a goal with no portfolio", () => {
    const place = firstPlaces(buildPlan(careerInput({ outcome: false })));

    expect(place.get("case-scope")).toBeGreaterThan(place.get("testing") ?? 0);
  });
});
