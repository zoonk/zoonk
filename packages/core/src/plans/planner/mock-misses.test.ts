import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { parsePlanSettings } from "./plan-state";
import { type MockMiss, getExamValue } from "./skill-order";

const TODAY = fromIsoDate("2026-10-07");
const TOPICS = ["fractions", "ratios", "percentages", "equations"];

function examInput(mockMisses?: ReadonlyMap<string, MockMiss>): BuildPlanInput {
  return {
    goal: { dailyMinutes: 30, kind: "exam", targetDate: addDays(TODAY, 60) },
    graph: {
      phases: [{ milestone: null, name: "Base" }],
      skills: TOPICS.map((skillId) => ({
        area: "Math",
        lessons: 3,
        name: skillId,
        phase: 0,
        skillId,
        weight: 3,
      })),
    },
    items: [],
    lessons: [],
    mockMinutes: 0,
    ...(mockMisses && { mockMisses }),
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

function topicOrder(input: BuildPlanInput): string[] {
  const first = new Map<string, number>();

  buildPlan(input)
    .items.filter((item) => item.kind === "lesson" && item.skillId)
    .forEach((item) => {
      const at = item.scheduledFor?.getTime() ?? Infinity;
      const skillId = item.skillId ?? "";
      first.set(skillId, Math.min(at, first.get(skillId) ?? Infinity));
    });

  return [...first].toSorted(([, a], [, b]) => a - b).map(([skillId]) => skillId);
}

describe("an exam plan after a mock", () => {
  it("teaches the topics the mock missed before the others of the same weight", () => {
    expect(topicOrder(examInput())).toStrictEqual(TOPICS);

    expect(topicOrder(examInput(new Map([["percentages", "missed"]])))).toStrictEqual([
      "percentages",
      "fractions",
      "ratios",
      "equations",
    ]);
  });

  it("puts a miss in a part under its minimum before any other miss", () => {
    const misses = new Map<string, MockMiss>([
      ["ratios", "missed"],
      ["equations", "shortPart"],
    ]);

    expect(topicOrder(examInput(misses)).slice(0, 2)).toStrictEqual(["equations", "ratios"]);
  });

  it("keeps a heavier topic the mock didn't miss ahead of a light one it did", () => {
    const input = examInput(new Map([["equations", "missed"]]));

    const weighted = {
      ...input,
      graph: {
        ...input.graph,
        skills: input.graph.skills.map((skill) => ({
          ...skill,
          weight: skill.skillId === "fractions" ? 5 : skill.weight,
        })),
      },
    };

    expect(topicOrder(weighted).slice(0, 2)).toStrictEqual(["fractions", "equations"]);
  });
});

describe(getExamValue, () => {
  it("leaves a topic the learner already recalls to what memory says of it", () => {
    const readiness = {
      reps: 3,
      retrievabilityAtTarget: 0.5,
      stability: 4,
      state: "learning" as const,
    };

    expect(getExamValue({ mockMiss: "shortPart", readiness, weight: 3 })).toBe(
      getExamValue({ readiness, weight: 3 }),
    );
  });
});
