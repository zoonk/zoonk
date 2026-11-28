import { type CourseLevel } from "@zoonk/db";
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

/** New plans stop at their aim; plans laid out before that rule keep every band. */
function aimed(aim: string | null, stopsAtAim = true) {
  return { goal: { aim }, settings: { stopsAtAim } };
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

function sizeFrom(level: string, aim: string, stopsAtAim = true): number {
  return total(
    sizeLanguageGraph({
      bands: NO_BANDS,
      goal: languageGoal(level),
      graph: graphOf([8, 14, 12]),
      state: aimed(aim, stopsAtAim),
    }).planned,
  );
}

function sizeAbove(aim: string, stopsAtAim = true) {
  return sizeLanguageGraph({
    bands: BANDS,
    goal: languageGoal("none"),
    graph: graphOf([10, 20, 10, 10, 10]),
    state: aimed(aim, stopsAtAim),
  });
}

describe(sizeLanguageGraph, () => {
  const sizing = { bands: NO_BANDS, goal: languageGoal("B1+"), state: aimed("B2") } as const;

  it("sizes a language goal's situations to reach the target level, each keeping its share", () => {
    const { graph, planned } = sizeLanguageGraph({ ...sizing, graph: graphOf([8, 14, 12]) });

    expect(total(planned)).toBe(656);
    expect(lessonsOf(planned)).toStrictEqual([154, 270, 232]);
    expect(graph).toStrictEqual(planned);
  });

  it.each([
    [653, [653, 1, 1, 1]],
    [655, [655, 1, 1, 1]],
  ] as const)("keeps open situations after %i settled lessons", (settled, expected) => {
    const { planned } = sizeLanguageGraph({
      ...sizing,
      graph: graphOf([settled, 100, 1, 1]),
      settledSkillIds: new Set(["s1"]),
    });

    expect(lessonsOf(planned)).toStrictEqual(expected);
  });

  it("counts the guided hours between the levels, half of each hour in new lessons", () => {
    expect(sizeFrom("none", "A2")).toBe(1425);
    expect(sizeFrom("intermediate", "B2")).toBe(sizeFrom("B1", "B2"));
  });

  it("keeps a half band's hours, so an aim of B1+ sizes past B1", () => {
    expect(sizeFrom("basic", "B1+")).toBeGreaterThan(sizeFrom("basic", "B1"));
  });

  it("gives the same graph when sized again, so a plan saved sized keeps its size", () => {
    const once = sizeLanguageGraph({ ...sizing, graph: graphOf([8, 14, 12]) }).graph;

    expect(sizeLanguageGraph({ ...sizing, graph: once }).graph).toStrictEqual(once);
  });

  it("keeps settled situations at their size and allocates only the remaining lessons", () => {
    const { planned } = sizeLanguageGraph({
      ...sizing,
      graph: graphOf([8, 14, 12]),
      settledSkillIds: new Set(["s1"]),
    });

    expect(lessonsOf(planned)).toStrictEqual([8, 349, 299]);
  });

  it("keeps other goals, language goals without an aim, and aims already reached, as they are", () => {
    const graph = graphOf([8, 14, 12]);
    const unchanged = { graph, planned: graph };
    const learn = { details: { level: "B1+" }, kind: "learn" } as const;

    expect(sizeLanguageGraph({ ...sizing, goal: learn, graph })).toStrictEqual(unchanged);
    expect(sizeLanguageGraph({ ...sizing, graph, state: aimed(null) })).toStrictEqual(unchanged);

    expect(sizeLanguageGraph({ ...sizing, goal: languageGoal("C1"), graph })).toStrictEqual(
      unchanged,
    );
  });

  it("stops at the aim: a trip course plans no situation above the beginner band", () => {
    const { graph, planned } = sizeAbove("A2");

    expect(idsOf(planned)).toStrictEqual(["s1", "s2"]);
    expect(total(planned)).toBe(1425);
    expect(graph.skills).toHaveLength(5);
  });

  it("plans every band in a plan laid out before aims stopped there, sizing only the aim's", () => {
    const { planned } = sizeAbove("A2", false);

    expect(lessonsOf(planned)).toStrictEqual([475, 950, 10, 10, 10]);
  });

  it("keeps the situations it leaves out as they are, so a higher aim sizes them by their band", () => {
    const trip = sizeAbove("A2").graph;

    expect(lessonsOf(trip)).toStrictEqual([475, 950, 10, 10, 10]);

    const talk = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("none"),
      graph: trip,
      state: aimed("B1"),
    });

    expect(idsOf(talk.planned)).toStrictEqual(["s1", "s2", "s3", "s4"]);
    expect(lessonsOf(talk.planned)).toStrictEqual([475, 950, 694, 694]);
  });

  it("gives each band the hours it teaches, so beginner situations get the A1 and A2 hours", () => {
    const { planned } = sizeAbove("B2");

    expect(lessonsOf(planned)).toStrictEqual([475, 950, 1350, 1350]);
  });

  it("leaves out the bands below the learner's level, so an A2 learner starts past the basics", () => {
    const { graph, planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("A2"),
      graph: graphOf([10, 20, 10, 10, 10]),
      state: aimed("B2"),
    });

    expect(idsOf(planned)).toStrictEqual(["s3", "s4"]);
    expect(lessonsOf(planned)).toStrictEqual([1350, 1350]);
    expect(lessonsOf(graph)).toStrictEqual([10, 20, 1350, 1350, 10]);
  });

  it("gives a learner inside a band only that band's hours they haven't studied", () => {
    const { planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("A1"),
      graph: graphOf([10, 20, 10, 10, 10]),
      state: aimed("B2"),
    });

    expect(lessonsOf(planned)).toStrictEqual([238, 475, 1350, 1350]);
  });

  it("keeps a situation below the learner's level that it's told to keep, at its size", () => {
    const { planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("A2"),
      graph: graphOf([10, 20, 10, 10, 10]),
      keepSkillIds: new Set(["s2"]),
      state: aimed("B2"),
    });

    expect(idsOf(planned)).toStrictEqual(["s2", "s3", "s4"]);
    expect(lessonsOf(planned)).toStrictEqual([20, 1350, 1350]);
  });

  it("gives the same graph when a plan split across bands is sized again", () => {
    const banded = { bands: BANDS, goal: languageGoal("A1"), state: aimed("B2") } as const;
    const once = sizeLanguageGraph({ ...banded, graph: graphOf([10, 20, 10, 10, 10]) }).graph;

    expect(sizeLanguageGraph({ ...banded, graph: once }).graph).toStrictEqual(once);
  });

  it("keeps a covered band when the course has nothing after it to plan", () => {
    const { planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("A2"),
      graph: graphOf([10, 20]),
      state: aimed("B2"),
    });

    expect(idsOf(planned)).toStrictEqual(["s1", "s2"]);
  });

  it("reaches into the next band when the aim is a half band past the learner's level", () => {
    const { planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("A2"),
      graph: graphOf([10, 20, 10, 10, 10]),
      state: aimed("A2+"),
    });

    expect(idsOf(planned)).toStrictEqual(["s3", "s4"]);
    expect(lessonsOf(planned)).toStrictEqual([347, 347]);
  });

  it("gives a band only its own hours when the course has nothing in the next one", () => {
    const { planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("none"),
      graph: graphOf([10, 20]),
      state: aimed("B2"),
    });

    expect(lessonsOf(planned)).toStrictEqual([475, 950]);
  });

  it("still stops at a lowered aim for a situation it keeps below the learner's level", () => {
    const { planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("none"),
      graph: graphOf([10, 20, 10, 10, 10]),
      keepSkillIds: new Set(["s3"]),
      state: aimed("A2"),
    });

    expect(idsOf(planned)).toStrictEqual(["s1", "s2"]);
  });

  it("counts a situation without a band in the aim's band, past the learner's covered basics", () => {
    const { planned } = sizeLanguageGraph({
      bands: new Map<string, CourseLevel>([["s1", "beginner"]]),
      goal: languageGoal("A2"),
      graph: graphOf([10, 4]),
      state: aimed("B2"),
    });

    expect(idsOf(planned)).toStrictEqual(["s2"]);
    expect(lessonsOf(planned)).toStrictEqual([2700]);
  });

  it("still stops at an aim the learner already reached, without sizing", () => {
    const { planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("advanced"),
      graph: graphOf([10, 20, 10, 10, 10]),
      state: aimed("A2"),
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

    const phased = (aim: string) =>
      sizeLanguageGraph({ bands: BANDS, goal: languageGoal("none"), graph, state: aimed(aim) });

    expect(phased("A2").planned.phases.map((phase) => phase.name)).toStrictEqual(["Basics"]);
    expect(phased("B2").planned.phases).toHaveLength(2);
    expect(phased("A2").graph.phases).toHaveLength(3);
  });

  it("stops at the aim before the level is known, without sizing", () => {
    const { planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal(),
      graph: graphOf([10, 20, 10, 10, 10]),
      state: aimed("B2"),
    });

    expect(lessonsOf(planned)).toStrictEqual([10, 20, 10, 10]);
  });

  it("keeps a settled situation above the aim, since the learner already studied it", () => {
    const { planned } = sizeLanguageGraph({
      bands: BANDS,
      goal: languageGoal("none"),
      graph: graphOf([10, 20, 10, 10, 10]),
      settledSkillIds: new Set(["s5"]),
      state: aimed("A2"),
    });

    expect(idsOf(planned)).toStrictEqual(["s1", "s2", "s5"]);
  });

  it("still owes the hours of a band the aim reaches that has no situations yet", () => {
    const { graph, planned } = sizeLanguageGraph({
      bands: new Map([...BANDS].filter(([, band]) => band !== "advanced")),
      goal: languageGoal("none"),
      graph: graphOf([10, 20, 10, 10]),
      state: aimed("C1"),
    });

    expect(lessonsOf(planned)).toStrictEqual([475, 950, 1350, 1350]);
    expect(planned.unwrittenLessons).toBe(1500);
    expect(graph.unwrittenLessons).toBeUndefined();
  });

  it("owes nothing when every band the aim reaches has situations", () => {
    expect(sizeAbove("C1").planned.unwrittenLessons).toBeUndefined();
  });
});
