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

function examInput(skills: PlanGraphSkill[]): BuildPlanInput {
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
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

describe("topics in a dated exam plan", () => {
  it("counts one subject's lessons only for that subject's topic, whatever the other topics are called", () => {
    const input = examInput(
      ["Physics", "Economics", "Chemistry", "Biology"].map((area) =>
        skill({ area, topic: "Equilibrium" }),
      ),
    );

    const built = buildPlan(input);
    const coverage = getSelectedCoverage({ built, examSubjects: null, input });

    expect(built.waitingSkillIds.length).toBeGreaterThan(0);
    expect(coverage).toMatchObject({ coreFits: false });
  });
});
