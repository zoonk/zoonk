import { describe, expect, it } from "vitest";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";

/** A Monday, three days before the exam. */
const TODAY = fromIsoDate("2026-10-12");

/** A skill of three lessons not written yet, teaching a topic of its own. */
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

/** Ten minutes a day for three days: time for few of the exam's topics' cores. */
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
  // The nucleus, answered right, wrong and right in placement, left the plan while viruses, asked
  // as often and missed by nobody, kept a lesson: a miss anywhere is a gap, whatever came after it.
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

  // Câmara's political science builds on the Constitution's principles and federal organization,
  // which the cut left out of constitutional law. The study cycle brought them forward for it,
  // ahead of fundamental rights, the constitutional topic asked most, which then didn't fit.
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
