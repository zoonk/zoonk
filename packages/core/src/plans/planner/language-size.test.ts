import { type CourseLevel } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { sizeLanguageGraph } from "./language-size";
import { type PlanGraph } from "./plan-state";

function graphOf(sizes: number[]): PlanGraph {
  return {
    phases: [{ milestone: null, name: "Interview" }],
    skills: sizes.map((lessons, index) => ({
      area: "English",
      lessons,
      name: `Situation ${index + 1}`,
      phase: 0,
      skillId: `s${index + 1}`,
      weight: null,
    })),
  };
}

const NO_BANDS = new Map<string, CourseLevel>();

const BANDS = new Map<string, CourseLevel>([
  ["s1", "beginner"],
  ["s2", "beginner"],
  ["s3", "intermediate"],
  ["s4", "intermediate"],
  ["s5", "advanced"],
]);

function languageGoal(level?: string) {
  return { details: level === undefined ? {} : { level }, kind: "language" } as const;
}

function total(graph: PlanGraph): number {
  return graph.skills.reduce((sum, skill) => sum + skill.lessons, 0);
}

function lessonsOf(graph: PlanGraph): number[] {
  return graph.skills.map((skill) => skill.lessons);
}

function idsOf(graph: PlanGraph): string[] {
  return graph.skills.map((skill) => skill.skillId);
}

function sizeFrom(level: string, aim: CefrLevel): number {
  return total(
    sizeLanguageGraph({
      aim,
      bands: NO_BANDS,
      goal: languageGoal(level),
      graph: graphOf([8, 14, 12]),
    }).planned,
  );
}

describe(sizeLanguageGraph, () => {
  const sizing = { aim: "B2", bands: NO_BANDS, goal: languageGoal("B1+") } as const;

  it("sizes a language goal's situations to reach the target level, each keeping its share", () => {
    const { graph, planned } = sizeLanguageGraph({ ...sizing, graph: graphOf([8, 14, 12]) });

    expect(total(planned)).toBe(656);
    expect(lessonsOf(planned)).toStrictEqual([154, 270, 232]);
    expect(graph).toStrictEqual(planned);
  });

  it("counts the guided hours between the levels, half of each hour in new lessons", () => {
    expect(sizeFrom("none", "A2")).toBe(1425);
    expect(sizeFrom("intermediate", "B2")).toBe(sizeFrom("B1", "B2"));
  });

  it("gives the same graph when sized again, so a plan saved sized keeps its size", () => {
    const once = sizeLanguageGraph({ ...sizing, graph: graphOf([8, 14, 12]) }).graph;

    expect(sizeLanguageGraph({ ...sizing, graph: once }).graph).toStrictEqual(once);
  });

  it("sizes only the situations the learner hasn't settled: those below their level stay out", () => {
    const { planned } = sizeLanguageGraph({
      ...sizing,
      graph: graphOf([8, 14, 12]),
      settledSkillIds: new Set(["s1"]),
    });

    expect(lessonsOf(planned)).toStrictEqual([8, 353, 303]);
  });

  it("keeps other goals, language goals without an aim, and aims already reached, as they are", () => {
    const graph = graphOf([8, 14, 12]);
    const unchanged = { graph, planned: graph };
    const learn = { details: { level: "B1+" }, kind: "learn" } as const;

    expect(sizeLanguageGraph({ ...sizing, goal: learn, graph })).toStrictEqual(unchanged);
    expect(sizeLanguageGraph({ ...sizing, aim: null, graph })).toStrictEqual(unchanged);

    expect(sizeLanguageGraph({ ...sizing, goal: languageGoal("C1"), graph })).toStrictEqual(
      unchanged,
    );
  });

  it("stops at the aim: a trip course plans no situation above the beginner band", () => {
    const { graph, planned } = sizeLanguageGraph({
      aim: "A2",
      bands: BANDS,
      goal: languageGoal("none"),
      graph: graphOf([10, 20, 10, 10, 10]),
    });

    expect(idsOf(planned)).toStrictEqual(["s1", "s2"]);
    expect(total(planned)).toBe(1425);
    expect(graph.skills).toHaveLength(5);
  });

  it("keeps the situations it leaves out at the same scale, so a higher aim brings them back", () => {
    const trip = sizeLanguageGraph({
      aim: "A2",
      bands: BANDS,
      goal: languageGoal("none"),
      graph: graphOf([10, 20, 10, 10, 10]),
    }).graph;

    expect(lessonsOf(trip)).toStrictEqual([475, 950, 475, 475, 475]);

    const talk = sizeLanguageGraph({
      aim: "B1",
      bands: BANDS,
      goal: languageGoal("none"),
      graph: trip,
    });

    expect(idsOf(talk.planned)).toStrictEqual(["s1", "s2", "s3", "s4"]);
    expect(lessonsOf(talk.planned)).toStrictEqual([563, 1125, 563, 562]);
  });

  it("still stops at an aim the learner already reached, without sizing", () => {
    const { planned } = sizeLanguageGraph({
      aim: "A2",
      bands: BANDS,
      goal: languageGoal("advanced"),
      graph: graphOf([10, 20, 10, 10, 10]),
    });

    expect(lessonsOf(planned)).toStrictEqual([10, 20]);
  });

  it("leaves out the phases after the aim's last situation", () => {
    const graph = {
      phases: ["Basics", "Everyday life", "Fluency"].map((name) => ({ milestone: null, name })),
      skills: graphOf([10, 20, 10, 10, 10]).skills.map((skill, index) => ({
        ...skill,
        phase: [0, 0, 1, 1, 2][index] ?? 0,
      })),
    };

    const sized = (aim: CefrLevel) =>
      sizeLanguageGraph({ aim, bands: BANDS, goal: languageGoal("none"), graph });

    expect(sized("A2").planned.phases.map((phase) => phase.name)).toStrictEqual(["Basics"]);
    expect(sized("B2").planned.phases).toHaveLength(2);
    expect(sized("A2").graph.phases).toHaveLength(3);
  });

  it("stops at the aim before the level is known, without sizing", () => {
    const { planned } = sizeLanguageGraph({
      aim: "B2",
      bands: BANDS,
      goal: languageGoal(),
      graph: graphOf([10, 20, 10, 10, 10]),
    });

    expect(lessonsOf(planned)).toStrictEqual([10, 20, 10, 10]);
  });

  it("keeps a settled situation above the aim, since the learner already studied it", () => {
    const { planned } = sizeLanguageGraph({
      aim: "A2",
      bands: BANDS,
      goal: languageGoal("none"),
      graph: graphOf([10, 20, 10, 10, 10]),
      settledSkillIds: new Set(["s5"]),
    });

    expect(idsOf(planned)).toStrictEqual(["s1", "s2", "s5"]);
  });
});
