import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { getSelectedCoverage } from "./selected-plan-summary";

const TODAY = fromIsoDate("2026-10-12");

function skill({
  area,
  lessons = 3,
  topic,
}: {
  area: string;
  lessons?: number;
  topic: string;
}): PlanGraphSkill {
  return { area, lessons, name: area, phase: 0, skillId: area, topics: [topic], weight: 1 };
}

function examInput({
  skills,
  skippedAreas = [],
}: {
  skills: PlanGraphSkill[];
  skippedAreas?: string[];
}): BuildPlanInput {
  return {
    goal: { dailyMinutes: 5, kind: "exam", targetDate: addDays(TODAY, 3) },
    graph: { phases: [{ milestone: null, name: "Basics" }], skills },
    items: [],
    lessons: [],
    mockMinutes: 60,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ skippedAreas, startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

function selectedCoverage(input: BuildPlanInput) {
  const subjects = input.graph.skills.map(({ area }) => area ?? "");
  const share = 1 / subjects.length;

  return getSelectedCoverage({
    built: buildPlan(input),
    examSubjects: subjects.map((area) => ({ areas: [area], share })),
    input,
  });
}

describe("what a plan reaches of the exam", () => {
  it("counts one subject's lessons only for that subject's topic, whatever the other topics are called", () => {
    const input = examInput({
      skills: ["Physics", "Economics", "Chemistry", "Biology"].map((area) =>
        skill({ area, topic: "Equilibrium" }),
      ),
    });

    const built = buildPlan(input);
    const coverage = selectedCoverage(input);

    expect(built.waitingSkillIds.length).toBeGreaterThan(0);
    expect(coverage).toMatchObject({ coreFits: false });
    expect(coverage?.reachedShare).toBeLessThan(1);
  });

});
