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

  it("puts a missed topic ahead of an unmissed heavier topic in the same phase", () => {
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

    expect(topicOrder(weighted).slice(0, 2)).toStrictEqual(["equations", "fractions"]);
  });

  it("leads the next study day with an available mock miss across exam subjects", () => {
    const input = examInput();
    const missed = "word-choice";

    const skills = [
      { area: "Math", skillId: "percentages", weight: 8 },
      { area: "Science", skillId: "food-chains", weight: 7 },
      { area: "Writing", skillId: "competencies", weight: 6 },
      { area: "Languages", skillId: "interpretation", weight: 3 },
      { area: "Languages", skillId: missed, weight: 3 },
      { area: "Languages", skillId: "register", weight: 2 },
      { area: "Languages", skillId: "genre", weight: 5 },
    ];

    const exam = {
      ...input,
      goal: { ...input.goal, dailyMinutes: 45 },
      graph: {
        ...input.graph,
        skills: skills.map((skill) => ({ ...skill, lessons: 3, name: skill.skillId, phase: 0 })),
      },
      openedKeys: [],
      prerequisites: new Map([["genre", ["register"]]]),
      settings: parsePlanSettings({ reducedAreas: ["Languages"], startDate: toIsoDate(TODAY) }),
      todayShown: true,
    } satisfies BuildPlanInput;

    const baseline = buildPlan(exam);

    const applied = buildPlan({
      ...exam,
      mockMisses: new Map([
        [missed, "missed"],
        ["register", "missed"],
        ["genre", "missed"],
      ]),
    });

    const lessonOf = (plan: typeof baseline, skillId: string) =>
      plan.items.find((item) => item.kind === "lesson" && item.skillId === skillId);

    expect(lessonOf(baseline, missed)?.scheduledFor).toBeDefined();
    expect(lessonOf(applied, missed)?.scheduledFor).toStrictEqual(addDays(TODAY, 1));

    expect(applied.items.indexOf(lessonOf(applied, missed)!)).toBeLessThan(
      applied.items.indexOf(lessonOf(applied, "interpretation")!),
    );

    expect(applied.items.indexOf(lessonOf(applied, "register")!)).toBeLessThan(
      applied.items.indexOf(lessonOf(applied, "genre")!),
    );

    expect(applied.droppedSkillIds).toStrictEqual(baseline.droppedSkillIds);

    expect(applied.phases.map(({ endDate }) => endDate)).toStrictEqual(
      baseline.phases.map(({ endDate }) => endDate),
    );

    const skipped = buildPlan({
      ...exam,
      mockMisses: new Map([[missed, "missed"]]),
      settings: { ...exam.settings, skippedAreas: ["Languages"] },
    });

    expect(lessonOf(skipped, missed)).toBeUndefined();

    const nextMock = buildPlan({ ...exam, mockMisses: new Map([["food-chains", "missed"]]) });

    expect(nextMock.items.indexOf(lessonOf(nextMock, "food-chains")!)).toBeLessThan(
      nextMock.items.indexOf(lessonOf(nextMock, missed)!),
    );
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
