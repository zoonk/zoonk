import { describe, expect, it } from "vitest";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";

const TODAY = fromIsoDate("2026-10-12");

function skill({ area, skillId }: { area: string; skillId: string }): PlanGraphSkill {
  return {
    area,
    lessons: 3,
    name: skillId,
    phase: 0,
    skillId,
    topics: [`Topic of ${skillId}`],
    weight: 3,
  };
}

function shortInput({
  skills,
  ...attrs
}: Partial<BuildPlanInput> & { skills: PlanGraphSkill[] }): BuildPlanInput {
  return {
    goal: { dailyMinutes: 10, kind: "exam", targetDate: addDays(TODAY, 3) },
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
    ...attrs,
  };
}

describe("an exam plan short on time", () => {
  it("keeps a topic missed once before one asked as often, though a later answer was right", () => {
    const plan = buildPlan(
      shortInput({
        answeredWrongSkillIds: new Set(["nucleus"]),
        knownSkillIds: new Set(["nucleus"]),
        skills: ["viruses", "nucleus"].map((skillId) => skill({ area: "Biology", skillId })),
      }),
    );

    expect(plan.waitingSkillIds).toStrictEqual(["viruses"]);
  });

  it("keeps a subject's most asked topic before what another subject's topic builds on", () => {
    const constitutional = ["principles", "federal", "rights"].map((skillId) =>
      skill({ area: "Constitutional law", skillId }),
    );

    const levels: TopicLevel[] = [
      ...constitutional.map(({ skillId }) => ({
        level: skillId === "rights" ? ("high" as const) : ("low" as const),
        subject: "Constitutional law",
        topic: `Topic of ${skillId}`,
      })),
      { level: "low", subject: "Political science", topic: "Topic of politics" },
    ];

    const plan = buildPlan(
      shortInput({
        prerequisites: new Map([["politics", ["principles", "federal"]]]),
        skills: [...constitutional, skill({ area: "Political science", skillId: "politics" })],
        topicLevels: levels,
      }),
    );

    expect(plan.waitingSkillIds).not.toContain("rights");
  });
});
