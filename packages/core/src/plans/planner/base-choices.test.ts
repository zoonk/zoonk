import { describe, expect, it } from "vitest";
import { chooseBases } from "./base-choices";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate } from "./plan-calendar";
import { type BaseChoice, type PlanGraphSkill, parsePlanSettings } from "./plan-state";

const AREA = "Biologia";

function skill(skillId: string, lessons: number): PlanGraphSkill {
  return { area: AREA, lessons, name: skillId, phase: 0, skillId, topics: [skillId], weight: null };
}

function examInput({
  choice,
  dailyMinutes,
}: {
  choice: Exclude<BaseChoice, "essential"> | null;
  dailyMinutes: number;
}): BuildPlanInput {
  return {
    goal: { dailyMinutes, kind: "exam", targetDate: fromIsoDate("2026-10-26") },
    graph: {
      phases: [{ milestone: null, name: "Everything" }],
      skills: [skill("a", 15), skill("b", 24), skill("c", 9), skill("d", 12)],
    },
    items: [],
    lessons: [],
    mockMinutes: 5,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([["c", ["b"]]]),
    readiness: new Map(),
    settings: parsePlanSettings({
      baseChoices: choice ? [{ choice, skillId: "b" }] : [],
      startDate: "2026-09-28",
    }),
    today: fromIsoDate("2026-09-28"),
    topicLevels: [
      { level: "high", subject: AREA, topic: "a" },
      { level: "low", subject: AREA, topic: "b" },
      { level: "high", subject: AREA, topic: "c" },
      { level: "high", subject: AREA, topic: "d" },
    ],
  };
}

function build(input: BuildPlanInput) {
  return buildPlan(chooseBases(input).input);
}

function keptTopics(input: BuildPlanInput): string[] {
  const built = build(input);
  const waiting = new Set(built.waitingSkillIds);

  return built.skillMinutes
    .map((entry) => entry.skillId)
    .filter((skillId) => !waiting.has(skillId))
    .toSorted();
}

function baseMinutes(input: BuildPlanInput): number {
  return build(input).skillMinutes.find((entry) => entry.skillId === "b")?.covered ?? 0;
}

describe(chooseBases, () => {
  it("never pushes out a topic the plan keeps with the base's core, whatever the choice", () => {
    for (const dailyMinutes of [5, 6, 8, 10, 20]) {
      const essential = keptTopics(examInput({ choice: null, dailyMinutes }));

      for (const choice of ["deep", "quick", "skip"] as const) {
        const chosen = keptTopics(examInput({ choice, dailyMinutes }));
        const expected = choice === "skip" ? essential.filter((topic) => topic !== "b") : essential;

        expect(chosen, `${choice} at ${dailyMinutes} min`).toStrictEqual(
          expect.arrayContaining(expected),
        );
      }
    }
  });

  it("brings in more of what the exam asks most with the time a quick lesson frees", () => {
    expect(keptTopics(examInput({ choice: null, dailyMinutes: 4 }))).toStrictEqual(["a", "d"]);
    expect(keptTopics(examInput({ choice: null, dailyMinutes: 7 }))).toStrictEqual(["a", "b", "d"]);

    expect(keptTopics(examInput({ choice: "quick", dailyMinutes: 4 }))).toStrictEqual([
      "a",
      "b",
      "d",
    ]);

    expect(keptTopics(examInput({ choice: "quick", dailyMinutes: 7 }))).toStrictEqual([
      "a",
      "b",
      "c",
      "d",
    ]);

    const partial = examInput({ choice: null, dailyMinutes: 6 });
    expect(baseMinutes(partial)).toBeLessThan(32);
    expect(keptTopics(partial)).toStrictEqual(["a", "d"]);
  });

  it("studies a base in depth with the time everything else leaves", () => {
    const core = baseMinutes(examInput({ choice: null, dailyMinutes: 60 }));
    const deep = baseMinutes(examInput({ choice: "deep", dailyMinutes: 60 }));

    expect(core).toBe(32);
    expect(deep).toBe(96);

    expect(baseMinutes(examInput({ choice: "deep", dailyMinutes: 5 }))).toBe(
      baseMinutes(examInput({ choice: null, dailyMinutes: 5 })),
    );
  });

  it("brings a skipped base's core back once the learner missed a question on it", () => {
    const skipped = examInput({ choice: "skip", dailyMinutes: 60 });

    expect(baseMinutes(skipped)).toBe(0);
    expect(baseMinutes({ ...skipped, missedSkillIds: new Set(["b"]) })).toBe(32);
  });
});
