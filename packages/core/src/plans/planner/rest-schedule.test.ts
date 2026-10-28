import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { getShownPhaseEnds } from "./kept-phase-ends";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

const TODAY = fromIsoDate("2026-10-12");

function skill(
  skillId: string,
  attrs: Pick<PlanGraphSkill, "area" | "lessons" | "phase"> & Partial<PlanGraphSkill>,
): PlanGraphSkill {
  return { name: skillId, skillId, weight: null, ...attrs };
}

function lessonsOf(skills: readonly PlanGraphSkill[], minutes: number): PlannerLesson[] {
  return skills.flatMap((item) =>
    Array.from({ length: item.lessons }, (_, index) => ({
      chapterId: item.skillId,
      lessonId: `${item.skillId}-${index}`,
      minutes,
      skillIds: [item.skillId],
      title: `${item.skillId} ${index + 1}`,
    })),
  );
}

function listPlannedSkills(plan: ReturnType<typeof buildPlan>): string[] {
  return [
    ...new Set(
      plan.items.flatMap((item) => (item.kind === "lesson" && item.skillId ? [item.skillId] : [])),
    ),
  ];
}

describe("a learn plan short on time keeping the phase ends the learner saw", () => {
  const skills = [
    skill("research", { area: "Research", lessons: 12, phase: 0 }),
    skill("portfolio", { area: "Portfolio", lessons: 10, outcome: true, phase: 1 }),
    skill("network", { area: "Job search", lessons: 2, outcome: true, phase: 2 }),
    skill("interviews", { area: "Job search", lessons: 2, outcome: true, phase: 2 }),
  ];

  const outcomes = new Set(["portfolio", "network", "interviews"]);

  const input: BuildPlanInput = {
    goal: { dailyMinutes: 10, kind: "learn", targetDate: addDays(TODAY, 17) },
    graph: {
      phases: ["Research", "Portfolio", "Job search"].map((name) => ({ milestone: null, name })),
      skills,
    },
    items: [],
    lessons: lessonsOf(skills, 5),
    mockMinutes: 0,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };

  const countOutcomeLessons = (plan: ReturnType<typeof buildPlan>) =>
    plan.items.filter(
      (item) =>
        item.kind === "lesson" && item.status === "todo" && outcomes.has(item.skillId ?? ""),
    ).length;

  it("keeps its outcome work through the next day's settle", () => {
    const made = buildPlan(input);
    const items = made.items.map((item, position) => ({ ...item, id: `${position}`, position }));
    const phaseEnds = getShownPhaseEnds({ items, phases: made.phases });

    expect(countOutcomeLessons(made)).toBe(14);
    expect(phaseEnds.size).toBeGreaterThan(0);

    const settled = buildPlan({
      ...input,
      carryOver: { lessonIds: [] },
      items,
      mode: "automatic",
      phaseEnds,
      setAsideLeftWork: true,
      today: addDays(TODAY, 1),
    });

    expect(countOutcomeLessons(settled)).toBe(14);

    for (const [phase, end] of phaseEnds) {
      const boss = settled.items.find((item) => item.kind === "boss" && item.phase === phase);

      const last = settled.items
        .filter((item) => item.kind === "lesson" && item.phase <= phase && item.scheduledFor)
        .reduce((latest, item) => Math.max(latest, item.scheduledFor?.getTime() ?? 0), 0);

      const held = last < end.getTime();
      const day = boss?.scheduledFor?.getTime();

      expect(day).toBe(held ? end.getTime() : addDays(new Date(last), 1).getTime());
    }
  });
});

describe("a class test short on time", () => {
  const skills = ["theory", "prokaryotes", "virus"].map((skillId) =>
    skill(skillId, { area: "Biologia", lessons: 2, phase: 0, topics: [skillId], weight: 3 }),
  );

  it("keeps a topic the learner missed, though they answered it right since, before one asked as often", () => {
    const plan = buildPlan({
      answeredWrongSkillIds: new Set(["virus"]),
      goal: { dailyMinutes: 20, kind: "exam", targetDate: addDays(TODAY, 3) },
      graph: { phases: [{ milestone: null, name: "Células" }], skills },
      items: [],
      knownSkillIds: new Set(["virus"]),
      lessons: lessonsOf(skills, 6),
      mockMinutes: 30,
      mode: "forced",
      paceFactor: 1,
      prerequisites: new Map(),
      readiness: new Map(),
      settings: parsePlanSettings({ shortMockMinutes: 30, startDate: toIsoDate(TODAY) }),
      today: TODAY,
    });

    expect(listPlannedSkills(plan)).toContain("virus");
    expect(plan.waitingSkillIds).toStrictEqual(["prokaryotes"]);
  });
});
